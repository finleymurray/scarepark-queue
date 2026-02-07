import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scarepark Queue Times",
  description: "Real-time queue management for the Halloween Scarepark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
