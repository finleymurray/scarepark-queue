import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#070E1A',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <Image
        src="/logo-control.png"
        alt="CoreLink"
        width={40}
        height={40}
        priority
        style={{ width: 40, height: 'auto', marginBottom: 32 }}
      />
      <h1
        style={{
          color: '#3B82F6',
          fontSize: '6rem',
          fontWeight: 800,
          lineHeight: 1,
          margin: 0,
          letterSpacing: '-0.03em',
        }}
      >
        404
      </h1>
      <p
        style={{
          color: '#475569',
          fontSize: '1rem',
          fontWeight: 500,
          marginTop: 12,
          marginBottom: 32,
        }}
      >
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/admin"
        style={{
          color: '#94A3B8',
          fontSize: 14,
          textDecoration: 'none',
          border: '1px solid #1E3048',
          padding: '10px 24px',
          borderRadius: 8,
          transition: 'border-color 0.15s, color 0.15s',
          fontWeight: 500,
        }}
      >
        Go to Admin
      </Link>
    </div>
  );
}
