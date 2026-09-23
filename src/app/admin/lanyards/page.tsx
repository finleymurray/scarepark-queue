'use client';

import { useCallback, useEffect, useState } from 'react';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';
import AdminNav from '@/components/AdminNav';
import { surface, border, text as textTok, accents, radius } from '@/lib/theme';

/*
 * Printable lanyard inserts for the queue timer: an A4 sheet of QR-coded
 * cards, each with a unique ID. Print via the browser dialog (save as PDF).
 * Layout: 2 × 5 cards per A4 page, ~95 × 55mm each (badge-insert size).
 */

// Unambiguous alphabet — no O/0, I/1/L, or S/5 confusion when read aloud
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';

function generateCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    let code = 'QT-';
    for (let i = 0; i < 5; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    codes.add(code);
  }
  return Array.from(codes);
}

const CARDS_PER_PAGE = 10;

export default function LanyardsPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [count, setCount] = useState(20);
  const [codes, setCodes] = useState<string[]>([]);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        window.location.href = '/login';
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');
      setLoading(false);
    }
    init();
  }, []);

  const regenerate = useCallback((n: number) => {
    setCodes(generateCodes(Math.max(1, Math.min(100, n))));
  }, []);

  // First batch once signed in
  useEffect(() => {
    if (!loading && codes.length === 0) regenerate(count);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Render QR data-URLs whenever the codes change
  useEffect(() => {
    let cancelled = false;
    async function render() {
      const entries = await Promise.all(
        codes.map(async (code) => {
          const url = await QRCode.toDataURL(code, {
            errorCorrectionLevel: 'M',
            margin: 0,
            width: 512,
            color: { dark: '#000000', light: '#FFFFFF' },
          });
          return [code, url] as const;
        }),
      );
      if (!cancelled) setQrUrls(Object.fromEntries(entries));
    }
    if (codes.length) render();
    return () => { cancelled = true; };
  }, [codes]);

  async function handleLogout() {
    await supabase.auth.signOut();
    clearAuthCache();
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: textTok.muted, fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  const ready = codes.length > 0 && codes.every((c) => qrUrls[c]);
  const pages: string[][] = [];
  for (let i = 0; i < codes.length; i += CARDS_PER_PAGE) {
    pages.push(codes.slice(i, i + CARDS_PER_PAGE));
  }

  return (
    <div style={{ minHeight: '100vh', background: surface.page }}>
      <div className="screen-only">
        <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />
      </div>

      {/* ── Controls (screen only) ── */}
      <div className="screen-only" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div>
            <h1 style={{ color: textTok.primary, fontSize: 20, fontWeight: 700, margin: 0 }}>Queue Timer Lanyards</h1>
            <p style={{ color: textTok.muted, fontSize: 13, margin: '4px 0 0' }}>
              Print A4 sheets of unique QR cards for lanyard inserts — 10 per page, cut along the guides.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ color: textTok.secondary, fontSize: 13 }}>
              Cards
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                style={{
                  width: 64, marginLeft: 8, background: surface.control, color: textTok.primary,
                  border: `1px solid ${border.strong}`, borderRadius: radius.sm, padding: '8px 10px', fontSize: 14,
                }}
              />
            </label>
            <button
              onClick={() => regenerate(count)}
              style={{
                background: surface.control, color: textTok.secondary, border: `1px solid ${border.strong}`,
                borderRadius: radius.sm, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              New codes
            </button>
            <button
              onClick={() => window.print()}
              disabled={!ready}
              style={{
                background: accents.admin.base, color: '#fff', border: 'none', borderRadius: radius.sm,
                padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: ready ? 1 : 0.5,
              }}
            >
              Print / Save PDF
            </button>
          </div>
        </div>
        <p style={{ color: textTok.faint, fontSize: 12, margin: '0 0 20px' }}>
          Every batch is unique — codes work the moment they&apos;re first scanned, no registration needed.
          In the print dialog choose A4, portrait, and set margins to &quot;None&quot; or &quot;Default&quot;.
        </p>
      </div>

      {/* ── Sheets (screen preview + print) ── */}
      <div className="sheets" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingBottom: 48 }}>
        {pages.map((pageCodes, pi) => (
          <div key={pi} className="sheet">
            {pageCodes.map((code) => (
              <div key={code} className="card">
                <div className="card-brand">CORELINK · QUEUE TIMER</div>
                {qrUrls[code] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrUrls[code]} alt={code} className="card-qr" />
                ) : (
                  <div className="card-qr" />
                )}
                <div className="card-code">{code}</div>
                <div className="card-note">
                  Please hand me to a staff member
                  <br />
                  at the attraction entrance
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <style jsx global>{`
        .sheet {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          padding: 8mm 10mm;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-auto-rows: 55mm;
          gap: 0;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
        }
        .card {
          border: 1px dashed #b8b8b8; /* cut guide */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 3mm;
          color: #000;
          background: #fff;
          overflow: hidden;
          font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .card-brand {
          font-size: 6.5pt;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #666;
          white-space: nowrap;
          margin-bottom: 1.5mm;
        }
        .card-qr {
          width: 20mm;
          height: 20mm;
        }
        .card-code {
          font-size: 12pt;
          font-weight: 800;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.06em;
          margin-top: 1.5mm;
          color: #000;
          white-space: nowrap;
        }
        .card-note {
          font-size: 8pt;
          font-weight: 600;
          line-height: 1.3;
          color: #222;
          margin-top: 1.5mm;
        }
        @media screen and (max-width: 850px) {
          .sheet {
            transform: scale(0.44);
            transform-origin: top center;
            margin-bottom: calc(-297mm * 0.56);
          }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: #fff !important;
          }
          .screen-only {
            display: none !important;
          }
          .sheets {
            padding: 0 !important;
            gap: 0 !important;
          }
          .sheet {
            box-shadow: none;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}
