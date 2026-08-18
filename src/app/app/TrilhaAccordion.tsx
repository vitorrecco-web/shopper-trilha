"use client";

import { useState } from "react";
import Link from "next/link";
import type { TrilhaView } from "@/lib/services/trilhaView";

function ModuleRow({ m }: { m: TrilhaView["phases"][number]["modules"][number] }) {
  const icon = m.completed ? "✓" : m.unlocked ? (m.isCurrent ? "▶" : "○") : "🔒";
  const iconColor = m.completed ? "#4ECDC4" : m.unlocked ? (m.isCurrent ? "#7F77DD" : "#9aa0a6") : "#5a5f68";

  const content = (
    <>
      <span style={{ color: iconColor, fontSize: 14, width: 18, textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: 14, color: m.unlocked ? "#f2f2f2" : "#9aa0a6" }}>{m.nome}</span>
      {m.isCurrent && (
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#7F77DD", whiteSpace: "nowrap" }}>continuar</span>
      )}
    </>
  );

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    background: m.isCurrent ? "#1a1830" : "transparent",
    border: m.isCurrent ? "1px solid #7F77DD" : "1px solid transparent",
    opacity: m.unlocked ? 1 : 0.6,
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
    <div style={{ border: "1px solid #22252b", borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 14px",
          background: "#14161a",
          border: "none",
          color: "#f2f2f2",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>{phase.nome}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#9aa0a6" }}>{phase.percent}%</span>
          <span style={{ fontSize: 12, color: "#9aa0a6" }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: "6px 8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {phase.modules.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9aa0a6", padding: "6px 8px" }}>Nenhum módulo nesta fase ainda.</p>
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
      <p style={{ color: "#9aa0a6", fontSize: 13, marginBottom: 16 }}>Olá, {nome}</p>

      <div style={{ border: "1px solid #22252b", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: "#9aa0a6" }}>Progresso geral</span>
          <span style={{ fontSize: 13 }}>
            {trilha.overallCompleted}/{trilha.overallTotal} módulos
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "#22252b", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${trilha.overallPercent}%`,
              background: "#4ECDC4",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {trilha.phases.length === 0 ? (
        <p style={{ fontSize: 14, color: "#9aa0a6" }}>
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
