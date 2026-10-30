import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shell } from '../components/Shell.tsx';
import { UploadIcon } from '../components/Icon.tsx';
import { parseLotCode } from '../lib/lotCode.ts';

export default function Scan() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(''); const [error, setError] = useState<string | null>(null);
  const go = (raw: string) => { const c = parseLotCode(raw); if (c) nav(`/l/${encodeURIComponent(c)}`); else setError(t('invalidCode')); };
  async function onUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { default: QrScanner } = await import('qr-scanner');
      const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      go(r.data);
    } catch { setError(t('noQrInImage')); }
  }
  useEffect(() => {
    let stop = () => undefined; let dead = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !video.current) return;
        const { default: QrScanner } = await import('qr-scanner'); // loaded only here: keeps it out of the first load
        if (dead) return;
        const s = new QrScanner(video.current, (r) => { const c = parseLotCode(r.data); if (c) { s.stop(); nav(`/l/${encodeURIComponent(c)}`); } }, { preferredCamera: 'environment', returnDetailedScanResult: true, highlightScanRegion: true });
        await s.start(); stop = () => { s.stop(); s.destroy(); };
      } catch { /* no camera: typing still works */ }
    })();
    return () => { dead = true; stop(); };
  }, [nav]);
  return (
    <Shell title={t('scanLot')} back="/">
      <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
      <button type="button" className="btn" onClick={() => fileInput.current?.click()}><UploadIcon className="size-5" /> {t('uploadQrImage')}</button>
      <input ref={fileInput} type="file" accept="image/*" aria-hidden tabIndex={-1} className="sr-only" data-testid="scan-upload" onChange={(e) => void onUpload(e.target.files?.[0])} />
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); go(typed); }}>
        <label className="block"><span className="label">{t('typeCode')}</span><input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="code-input" autoCapitalize="characters" /></label>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <button className="btn btn-primary" data-testid="code-go">{t('open')}</button>
      </form>
    </Shell>
  );
}
