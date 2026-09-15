import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentSession } from "@/lib/auth/getSession";
import { AssistantWidget } from "@/components/ui/AssistantWidget";

export const metadata: Metadata = {
  title: "Shopper Trilha",
  description: "Trilha de capacitação para supervisores — Shopper",
  icons: { icon: "/shopper-logo.png" },
};

// Mobile-first: viewport correto desde já (§10.1 — prioridade para celular).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1FA97A",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O widget do Assistente Shopper só aparece em página autenticada —
  // nunca em /login. checagem aqui é só de apresentação; toda rota
  // continua com sua própria checagem de sessão (defesa em profundidade
  // já usada em todo o projeto).
  const session = await getCurrentSession();

  return (
    <html lang="pt-BR">
      <body>
        {children}
        {session && <AssistantWidget />}
      </body>
    </html>
  );
}
