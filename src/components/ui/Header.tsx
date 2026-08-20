"use client";

import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Logo, BrandWordmark } from "./Logo";
import { LogoutButton } from "@/components/LogoutButton";

/**
 * Header padrão: [logo] Shopper Trilha ... nome / Sair
 * Usado em toda página autenticada (student e admin). `context` mostra
 * "Painel do Gestor" só quando faz sentido (rotas /admin).
 */
export function Header({
  nome,
  context,
  homeHref,
}: {
  nome?: string;
  context?: string;
  homeHref: string;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.space(3),
        padding: `${theme.space(3)} ${theme.space(4)}`,
        background: theme.color.surface,
        borderBottom: `1px solid ${theme.color.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <Link
        href={homeHref}
        style={{ display: "flex", alignItems: "center", gap: theme.space(2), textDecoration: "none" }}
      >
        <Logo height={26} />
        <span style={{ width: 1, height: 20, background: theme.color.border }} />
        <BrandWordmark size={theme.font.size.md} />
        {context && (
          <span
            style={{
              marginLeft: theme.space(1),
              fontSize: theme.font.size.xs,
              color: theme.color.primary,
              background: theme.color.primaryLight,
              padding: "2px 8px",
              borderRadius: theme.radius.pill,
              fontWeight: 600,
            }}
          >
            {context}
          </span>
        )}
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: theme.space(3), minWidth: 0 }}>
        {nome && (
          <span
            style={{
              fontSize: theme.font.size.sm,
              color: theme.color.textMuted,
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nome}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
