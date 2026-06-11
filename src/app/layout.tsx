import type { Metadata, Viewport } from "next";
import { DM_Sans, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "CoreLink",
  description: "CoreLink Operations Platform",
  manifest: "/manifest.json",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CoreLink",
  },
  icons: {
    icon: "/favicons/control.ico",
    apple: "/icons/control-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${bebasNeue.variable}`}>
      <head>
        {/* Preconnect: saves a DNS+TLS handshake on the first Supabase call of every page load */}
        <link rel="preconnect" href="https://eugqphnpqvqubusqemgv.supabase.co" crossOrigin="anonymous" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
