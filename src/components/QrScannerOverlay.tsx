import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { X } from 'lucide-react';

/**
 * Vollbild-Overlay zum Scannen des Raum-QR-Codes mit der Gerätekamera.
 * Ruft `onResult` mit dem decodierten Text auf (i. d. R. eine URL mit ?room=).
 */
export const QrScannerOverlay = ({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;

    const scanner = new QrScanner(
      video,
      (result) => {
        if (active) onResult(result.data);
      },
      { highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: 'environment' }
    );

    scanner.start().catch(() => {
      setError('Kamera konnte nicht gestartet werden. Bitte erlaube den Kamera-Zugriff im Browser.');
    });

    return () => {
      active = false;
      scanner.stop();
      scanner.destroy();
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-lg">QR-Code scannen</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error ? (
          <div className="bg-white/10 border border-white/10 rounded-2xl p-6 text-center text-slate-200 text-sm leading-relaxed">
            {error}
          </div>
        ) : (
          <>
            <div className="relative rounded-2xl overflow-hidden border border-white/15 aspect-square bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            </div>
            <p className="text-slate-400 text-xs text-center mt-3">
              Halte den QR-Code deines Lehrers vor die Kamera.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors cursor-pointer"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
};
