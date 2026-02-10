import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#ccc', padding: '24px 20px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="Immersive Core"
              width={28}
              height={28}
              priority
              style={{ width: 28, height: 'auto', opacity: 0.6 }}
            />
            <span style={{ color: '#888', fontSize: 13 }}>&larr; Back to login</span>
          </Link>
        </div>

        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 32 }}>
          ImmersiveCore Attraction Operations Panel
        </p>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 24 }}>
          Last Updated: February 10, 2026
        </p>

        {/* 1. Introduction */}
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 28 }}>
          1. Introduction
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
          This Privacy Policy applies to the ImmersiveCore Attraction Operations Panel (formerly Scarepark Queue),
          an internal tool used by staff to manage park operations, ride throughput, and queue times. We respect
          your privacy and are committed to protecting the personal data of our staff.
        </p>

        {/* 2. What Data We Collect */}
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 28 }}>
          2. What Data We Collect
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
          To operate this system securely and effectively, we collect the following data about our authorized users (Staff):
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8, marginBottom: 12 }}>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Identity Data:</strong> Name, email address, and assigned role (e.g., Admin, Supervisor).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Authentication Data:</strong> Encrypted login credentials and session logs, managed via Supabase Auth.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Operational Audit Logs:</strong> We record specific actions taken within the app, including:
            <ul style={{ paddingLeft: 20, marginTop: 4 }}>
              <li>Opening or closing attractions.</li>
              <li>Updating wait times.</li>
              <li>Modifying park settings.</li>
              <li>Submitting throughput (guest count) reports.</li>
            </ul>
          </li>
        </ul>
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.7, marginBottom: 16 }}>
          Note: These logs are linked to your User ID to ensure accountability and security.
        </p>

        {/* 3. How We Use This Data */}
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 28 }}>
          3. How We Use This Data
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
          We process this data under the lawful basis of Legitimate Interests for the following purposes:
        </p>
        <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Security &amp; Access Control:</strong> To ensure only authorized staff can modify safety-critical park settings.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Operational Accountability:</strong> To maintain an audit trail of who made changes to park operations (e.g., &ldquo;User X updated the queue time at 14:00&rdquo;).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Performance Analysis:</strong> To analyze ride throughput and staffing efficiency based on the logs submitted.
          </li>
        </ul>

        {/* 4. Data Sharing & Storage */}
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 28 }}>
          4. Data Sharing &amp; Storage
        </h2>
        <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Supabase:</strong> Your account data and activity logs are stored securely in our cloud database provider, Supabase.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>No Public Sharing:</strong> Data entered into this system is strictly for internal operational use. We do not share staff data with third parties unless required by law.
          </li>
        </ul>

        {/* 5. Data Retention */}
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 28 }}>
          5. Data Retention
        </h2>
        <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8, marginBottom: 16 }}>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Activity Logs:</strong> Operational logs (e.g., queue updates) are retained for 2 years to allow for historical analysis and security auditing.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>Account Data:</strong> User accounts are maintained for the duration of your employment or authorized access period.
          </li>
        </ul>

        {/* 6. Contact & Rights */}
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8, marginTop: 28 }}>
          6. Contact &amp; Rights
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 48 }}>
          Staff members have the right to request access to their personal data or correction of inaccurate
          information. For privacy queries, please contact the IT Compliance Team.
        </p>
      </div>
    </div>
  );
}
