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
        background: '#000',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <Image
        src="/logo.png"
        alt="Immersive Core"
        width={48}
        height={48}
        priority
        style={{ width: 48, height: 'auto', marginBottom: 32, opacity: 0.6 }}
      />
      <h1
        style={{
          color: '#fff',
          fontSize: '6rem',
          fontWeight: 900,
          lineHeight: 1,
          margin: 0,
        }}
      >
        404
      </h1>
      <p
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '1.1rem',
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
          color: '#aaa',
          fontSize: 14,
          textDecoration: 'none',
          border: '1px solid #333',
          padding: '10px 24px',
          borderRadius: 8,
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        Go to Admin
      </Link>
    </div>
  );
}
