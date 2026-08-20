"use client";

import { useState } from "react";
import Link from "next/link";
import type { TrilhaView } from "@/lib/services/trilhaView";
import { theme } from "@/lib/ui/theme";
import { ProgressBar } from "@/components/ui/ProgressBar";

function ModuleRow({ m }: { m: TrilhaView["phases"][number]["modules"][number] }) {
  const icon = m.completed ? "✓" : m.unlocked ? (m.isCurrent ? "▶" : "○") : "🔒";
  const iconColor = m.completed
    ? theme.color.primary
    : m.unlocked
      ? m.isCurrent
        ? theme.color.primaryDark
        : theme.color.textFaint
      : theme.color.textFaint;

  const content = (
    <>
      <span style={{ color: iconColor, fontSize: 14, width: 18, textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: 14, color: m.unlocked ? theme.color.text : theme.color.textFaint }}>{m.nome}</span>
      {m.isCurrent && (
        <span style={{ marginLeft: "auto", fontSize: 11, color: theme.color.primaryDark, fontWeight: 700, whiteSpace: "nowrap" }}>
          continuar
        </span>
      )}
    </>
  );

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    borderRadius: theme.radius.md,
    background: m.isCurrent ? theme.color.primaryLight : "transparent",
    border: m.isCurrent ? `1px solid ${theme.color.primary}` : "1px solid transparent",
    opacity: m.unlocked ? 1 : 0.65,
    minHeight: 44, // área de toque confortável em mobile
  };

  // §10.1: módulo bloqueado continua mostrando nome/título, mas não é
  // clicável — só módulo liberado abre a página própria (§10.3).
  if (!m.unlocked) {
    return <div style={rowStyle}>{content}</div>;
  }

  return (
    <Link href={`/app/modulo/${m.id}`} style={{ ...rowStyle, textDecoration: "none" }}>
      {content}
    </Link>
  );
}

function PhaseAccordionItem({ phase, defaultOpen }: { phase: TrilhaView["phases"][number]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.sm,
        marginBottom: theme.space(3),
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 16px",
          background: "transparent",
          border: "none",
          color: theme.color.text,
          textAlign: "left",
          cursor: "pointer",
          minHeight: 52,
        }}
      >
        <span style={{ fontSize: theme.font.size.md, fontWeight: 600 }}>{phase.nome}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: theme.font.size.xs,
              color: phase.percent === 100 ? theme.color.primaryDark : theme.color.textMuted,
              fontWeight: 600,
            }}
          >
            {phase.percent}%
          </span>
          <span style={{ fontSize: 12, color: theme.color.textFaint }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "4px 10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            borderTop: `1px solid ${theme.color.border}`,
          }}
        >
          {phase.modules.length === 0 ? (
            <p style={{ fontSize: 13, color: theme.color.textMuted, padding: "10px 8px" }}>
              Nenhum módulo nesta fase ainda.
            </p>
          ) : (
            phase.modules.map((m) => <ModuleRow key={m.id} m={m} />)
          )}
        </div>
      )}
    </div>
  );
}

export function TrilhaAccordion({ trilha, nome }: { trilha: TrilhaView; nome: string }) {
  return (
    <div>
      <h1 style={{ fontSize: theme.font.size.xl, marginTop: 0, marginBottom: 2, color: theme.color.text }}>
        Minha Trilha
      </h1>
      <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
        Olá, {nome}
      </p>

      <div
        style={{
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadow.sm,
          padding: theme.space(4),
          marginBottom: theme.space(5),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Progresso geral</span>
          <span style={{ fontSize: theme.font.size.sm, color: theme.color.text, fontWeight: 600 }}>
            {trilha.overallCompleted}/{trilha.overallTotal} módulos
          </span>
        </div>
        <ProgressBar percent={trilha.overallPercent} height={8} />
      </div>

      {trilha.phases.length === 0 ? (
        <p style={{ fontSize: 14, color: theme.color.textMuted }}>
          Nenhuma fase ativa encontrada para sua trilha ainda. Fale com o gestor.
        </p>
      ) : (
        trilha.phases.map((phase) => (
          <PhaseAccordionItem key={phase.id} phase={phase} defaultOpen={phase.isDefaultOpen} />
        ))
      )}
    </div>
  );
}
