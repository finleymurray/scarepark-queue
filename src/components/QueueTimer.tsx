'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  scanLanyard,
  fetchOpenTimings,
  voidTiming,
  roundToNearest5,
  type QueueTiming,
} from '@/lib/queueTimer';
import { surface, border, text, accents, radius, FONT_NUM, controlButton, primaryButton } from '@/lib/theme';
import jsQR from 'jsqr';

/* Native BarcodeDetector where available (Chrome/Android — fast, multi-format);
 * everywhere else (iPhone Safari/WebKit) frames are decoded with jsQR. */
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!ctor) return null;
  try {
    return new ctor({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
  } catch {
    return null;
  }
}

/** Decode a QR from the current video frame via jsQR (downscaled for speed). */
function decodeFrameWithJsQR(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.min(1, 480 / vw);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const result = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
  return result?.data?.trim() || null;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function elapsedMins(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
}

export default function QueueTimer({
  attractionId,
  currentWait,
  operatorName,
  onSetWaitTime,
  onToast,
}: {
  attractionId: string;
  currentWait: number;
  operatorName: string;
  /** Sets the live queue time to an absolute value; resolves true on success. */
  onSetWaitTime: (mins: number) => Promise<boolean>;
  onToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [codeInput, setCodeInput] = useState('');
  const [openTimings, setOpenTimings] = useState<QueueTiming[]>([]);
  const [lastResult, setLastResult] = useState<QueueTiming | null>(null);
  const [applying, setApplying] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFeedback, setCameraFeedback] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectLoopRef = useRef<number | null>(null);
  // Per-code cooldown so a lanyard held in front of the camera scans once
  const recentScansRef = useRef<Map<string, number>>(new Map());

  const refreshOpen = useCallback(async () => {
    setOpenTimings(await fetchOpenTimings(attractionId));
  }, [attractionId]);

  // Load + live-sync the in-queue list (scans may come from another device)
  useEffect(() => {
    refreshOpen();
    setLastResult(null);
    const channel = supabase
      .channel(`queue-timer-${attractionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_timings', filter: `attraction_id=eq.${attractionId}` },
        refreshOpen,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [attractionId, refreshOpen]);

  // Re-render every 30s so elapsed times stay honest
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const handleScan = useCallback(
    async (raw: string): Promise<string | null> => {
      if (scanning) return null;
      setScanning(true);
      try {
        const result = await scanLanyard(attractionId, raw, operatorName);
        switch (result.action) {
          case 'started':
            setLastResult(null);
            refreshOpen();
            return `${result.timing.lanyard_code} in queue`;
          case 'completed':
            setLastResult(result.timing);
            refreshOpen();
            return `${result.timing.lanyard_code} — ${formatDuration(result.timing.duration_secs || 0)}`;
          case 'duplicate':
            return null; // same lanyard within seconds — ignore quietly
          case 'error':
            onToast('error', result.message);
            return null;
        }
      } finally {
        setScanning(false);
      }
    },
    [attractionId, operatorName, refreshOpen, scanning, onToast],
  );

  async function handleManualSubmit() {
    const code = codeInput.trim();
    if (!code) return;
    setCodeInput('');
    const msg = await handleScan(code);
    if (msg) onToast('success', msg);
  }

  /* ── Camera scanning ── */

  const stopCamera = useCallback(() => {
    if (detectLoopRef.current !== null) {
      cancelAnimationFrame(detectLoopRef.current);
      detectLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraFeedback(null);
    setCameraError(null);
  }, []);

  useEffect(() => stopCamera, [stopCamera]); // release camera on unmount

  async function openCamera() {
    const detector = getBarcodeDetector(); // null on iPhone → jsQR fallback
    setCameraOpen(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const scratchCanvas = document.createElement('canvas');
      let lastDecodeAt = 0;
      const loop = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;
        if (video.readyState >= 2) {
          let code: string | null = null;
          try {
            if (detector) {
              const codes = await detector.detect(video);
              code = codes[0]?.rawValue?.trim() || null;
            } else if (Date.now() - lastDecodeAt > 150) {
              // jsQR is CPU-bound — throttle to ~6 fps to keep the phone cool
              lastDecodeAt = Date.now();
              code = decodeFrameWithJsQR(video, scratchCanvas);
            }
          } catch {
            /* frame not ready — keep looping */
          }
          if (code) {
            const last = recentScansRef.current.get(code) || 0;
            if (Date.now() - last > 5000) {
              recentScansRef.current.set(code, Date.now());
              const msg = await handleScan(code);
              if (msg) setCameraFeedback(msg);
              if (navigator.vibrate) navigator.vibrate(80);
            }
          }
        }
        detectLoopRef.current = requestAnimationFrame(loop);
      };
      detectLoopRef.current = requestAnimationFrame(loop);
    } catch {
      setCameraError('Camera unavailable — allow camera access or type the code.');
    }
  }

  /* ── Apply measured time ── */

  const suggested = lastResult ? roundToNearest5(lastResult.duration_secs || 0) : null;

  async function applySuggested() {
    if (suggested == null || applying) return;
    setApplying(true);
    const ok = await onSetWaitTime(suggested);
    setApplying(false);
    if (ok) {
      onToast('success', `Queue time set to ${suggested} min`);
      setLastResult(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: surface.control,
    border: `1px solid ${border.default}`,
    borderRadius: radius.md,
    color: text.primary,
    fontSize: 15,
    padding: '12px 14px',
    outline: 'none',
    ...FONT_NUM,
  };

  return (
    <div>
      {/* Scan row — a USB/Bluetooth scanner types the code and presses Enter */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit(); }}
          placeholder="Scan or type lanyard code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          style={inputStyle}
        />
        <button
          onClick={handleManualSubmit}
          disabled={!codeInput.trim() || scanning}
          style={{ ...primaryButton('control'), minHeight: 46, padding: '0 18px', fontSize: 14, fontWeight: 700, opacity: !codeInput.trim() || scanning ? 0.5 : 1 }}
          className="transition-colors touch-manipulation"
        >
          Scan
        </button>
        <button
          onClick={openCamera}
          aria-label="Scan with camera"
          style={{ ...controlButton, minHeight: 46, minWidth: 46, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          className="transition-colors touch-manipulation"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={text.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>
      </div>

      {/* Measured result → one-tap update */}
      {lastResult && suggested != null && (
        <div style={{
          marginTop: 12,
          background: accents.control.soft,
          border: `1px solid ${accents.control.base}40`,
          borderRadius: radius.md,
          padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: text.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Timed queue run · {lastResult.lanyard_code}
              </div>
              <div style={{ color: text.primary, fontSize: 26, fontWeight: 800, marginTop: 2, ...FONT_NUM }}>
                {formatDuration(lastResult.duration_secs || 0)}
              </div>
            </div>
            <button
              onClick={() => setLastResult(null)}
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', color: text.faint, cursor: 'pointer', padding: 6, flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <button
            onClick={applySuggested}
            disabled={applying}
            style={{ ...primaryButton('control'), width: '100%', minHeight: 48, marginTop: 12, fontSize: 14, fontWeight: 700, opacity: applying ? 0.6 : 1 }}
            className="active:bg-[#1D4ED8] transition-colors touch-manipulation"
          >
            {suggested === currentWait
              ? `Queue time already ${suggested} min ✓`
              : `Set queue time to ${suggested} min`}
          </button>
        </div>
      )}

      {/* Lanyards currently in the queue */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: text.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            In queue
          </span>
          <span style={{ color: text.secondary, fontSize: 12, ...FONT_NUM }}>{openTimings.length}</span>
        </div>
        {openTimings.length === 0 ? (
          <p style={{ color: text.faint, fontSize: 12, margin: '8px 0 0' }}>
            Scan a lanyard at the queue entrance to start timing.
          </p>
        ) : (
          <div style={{ marginTop: 6 }}>
            {openTimings.map((t) => (
              <div
                key={t.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${border.divider}` }}
              >
                <span style={{ color: text.primary, fontSize: 13, fontWeight: 600, ...FONT_NUM }}>{t.lanyard_code}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: text.secondary, fontSize: 13, ...FONT_NUM }}>{elapsedMins(t.started_at)} min</span>
                  <button
                    onClick={async () => {
                      if (await voidTiming(t.id)) refreshOpen();
                      else onToast('error', 'Failed to remove lanyard');
                    }}
                    aria-label={`Remove ${t.lanyard_code}`}
                    style={{ background: 'none', border: 'none', color: text.faint, cursor: 'pointer', padding: 4 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Camera scan modal — stays open for scan-after-scan use */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div style={{ width: '100%', maxWidth: 420, background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 20 }}>
            <p style={{ color: text.primary, fontSize: 14, fontWeight: 700, margin: '0 0 12px', textAlign: 'center' }}>
              Scan lanyard
            </p>
            {cameraError ? (
              <p style={{ color: text.muted, fontSize: 13, textAlign: 'center', margin: '18px 0' }}>{cameraError}</p>
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: radius.md, background: '#000' }}
              />
            )}
            <div style={{ minHeight: 22, textAlign: 'center', marginTop: 10 }}>
              {cameraFeedback && (
                <span style={{ color: accents.control.base, fontSize: 13, fontWeight: 600, ...FONT_NUM }}>{cameraFeedback}</span>
              )}
            </div>
            <button
              onClick={stopCamera}
              style={{ ...controlButton, width: '100%', minHeight: 48, marginTop: 8, fontSize: 14, fontWeight: 600 }}
              className="transition-colors touch-manipulation"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
