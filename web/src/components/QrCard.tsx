import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
/** The label carries the lot id (a UUID), so two lots can never share a label even if their short codes collide. */
export const lotUrl = (lotId: string) => `${window.location.origin}/l/${lotId}`;
export function QrCard({ lotId, shortCode, cropName }: { lotId: string; shortCode: string; cropName: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="print-area mx-auto w-fit space-y-2 rounded-lg bg-white p-4 text-center text-black" data-qr-url={lotUrl(lotId)} data-testid="qr-label">
        <QRCodeSVG value={lotUrl(lotId)} size={200} marginSize={2} />
        <div className="text-2xl font-extrabold tracking-wider" data-testid="lot-code">{shortCode}</div>
        <div className="text-sm">{cropName}</div>
      </div>
      <button className="btn no-print" onClick={() => window.print()}>{t('printLabel')}</button>
    </div>
  );
}
