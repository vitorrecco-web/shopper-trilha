"use client";

import { useState } from "react";
import { theme } from "@/lib/ui/theme";

/**
 * Seção em dropdown (fecha/abre ao clicar no cabeçalho) — usada nos painéis de
 * Indicadores para que o conteúdo só apareça quando a pessoa quer ver.
 * `summary` é um resumo curto que fica sempre visível no cabeçalho (ex: "4
 * colaboradores"), então dá para ler o essencial sem abrir.
 */
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  children,
  nested = false,
}: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Visual mais leve, para dropdown dentro de dropdown. */
  nested?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: nested ? theme.color.bg : theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: nested ? theme.radius.md : theme.radius.lg,
        boxShadow: nested ? "none" : theme.shadow.sm,
        marginBottom: nested ? theme.space(2) : theme.space(4),
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          background: "transparent",
          border: "none",
          padding: nested ? "10px 12px" : `${theme.space(3)} ${theme.space(4)}`,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              display: "inline-block",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              color: theme.color.textFaint,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            ▶
          </span>
          <span
            style={{
              fontSize: nested ? theme.font.size.sm : theme.font.size.md,
              fontWeight: 600,
              color: theme.color.text,
            }}
          >
            {title}
          </span>
        </span>
        {summary && (
          <span style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, textAlign: "right" }}>{summary}</span>
        )}
      </button>
      {open && (
        <div
          style={{
            padding: nested ? "4px 12px 12px" : `${theme.space(1)} ${theme.space(4)} ${theme.space(4)}`,
            borderTop: `1px solid ${theme.color.border}`,
          }}
        >
          <div style={{ paddingTop: theme.space(3) }}>{children}</div>
        </div>
      )}
    </div>
  );
}
