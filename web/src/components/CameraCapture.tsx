import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type CaptureMethod = 'camera' | 'file_input';
/** In-app camera so photos cannot come from the gallery. If the camera is unavailable the system picker is used and the photo is flagged. */
export function CameraCapture({ onCapture, onCancel, testPrefix }: { onCapture: (b: Blob, m: CaptureMethod) => void; onCancel: () => void; testPrefix: string }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then((s) => {
      if (cancelled) { s.getTracks().forEach((x) => x.stop()); return; }
      stream.current = s; if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => undefined); }
    }).catch(() => setFallback(true));
    if (!navigator.mediaDevices?.getUserMedia) setFallback(true);
    return () => { cancelled = true; stream.current?.getTracks().forEach((x) => x.stop()); };
  }, []);
  function snap() {
    const v = video.current; if (!v) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => { if (b) onCapture(b, 'camera'); }, 'image/jpeg', 0.9);
  }
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black" role="dialog" aria-label={t('takePhoto')}>
      {fallback ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <p>{t('cameraUnavailable')}</p>
          <label className="btn btn-primary !w-auto cursor-pointer">{t('takePhoto')}<input type="file" accept="image/*" capture="environment" className="sr-only" data-testid={`${testPrefix}-file`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(f, 'file_input'); }} /></label>
        </div>
      ) : <video ref={video} playsInline muted className="min-h-0 flex-1 object-cover" />}
      <div className="flex gap-3 bg-black p-4">
        <button className="btn" onClick={onCancel}>{t('cancel')}</button>
        {!fallback && <button className="btn btn-primary" onClick={snap} data-testid={`${testPrefix}-snap`}>{t('takePhoto')}</button>}
      </div>
    </div>
  );
}
