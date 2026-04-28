import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIST30 AI — Borsa Analiz Sistemi",
  description: "Gemini destekli otomatik BIST30 tarama ve öneri platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
