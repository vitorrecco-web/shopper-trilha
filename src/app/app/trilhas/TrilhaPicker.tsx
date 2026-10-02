"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";

interface TrilhaOption {
  programId: string;
  programNome: string;
  trackNome: string | null;
  percent: number | null;
}

const cardStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(3),
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: theme.space(3),
  flexWrap: "wrap",
};

export function TrilhaPicker({ options, viewOnly = false }: { options: TrilhaOption[]; viewOnly?: boolean }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEnter(programId: string) {
    setError(null);
    setLoadingId(programId);
    try {
      const res = await fetch("/api/app/escolher-trilha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível entrar nessa trilha agora.");
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: theme.font.size.sm, marginBottom: theme.space(3) }}>
          {error}
        </p>
      )}
      {options.map((o) => (
        <div key={o.programId} style={cardStyle}>
          <div>
            <b style={{ fontSize: theme.font.size.md, color: theme.color.text }}>{o.programNome}</b>
            {o.trackNome && (
              <div style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginTop: 2 }}>
                {o.trackNome}
              </div>
            )}
            <div style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: 4 }}>
              {viewOnly
                ? "Modo visualização"
                : o.percent !== null
                  ? `${o.percent}% concluído`
                  : "Progresso indisponível"}
            </div>
          </div>
          <Button onClick={() => handleEnter(o.programId)} disabled={loadingId !== null}>
            {loadingId === o.programId ? "Entrando..." : "Entrar"}
          </Button>
        </div>
      ))}
    </div>
  );
}
