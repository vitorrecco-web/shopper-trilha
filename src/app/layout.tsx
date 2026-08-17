import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopper Trilha",
  description: "Trilha de capacitação para supervisores — Shopper",
};

// Mobile-first: viewport correto desde já (§10.1 — prioridade para celular).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
