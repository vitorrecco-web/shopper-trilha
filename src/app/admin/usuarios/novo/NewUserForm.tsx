"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Program, Track } from "@/lib/db/types";
import { theme } from "@/lib/ui/theme";
import { roleLabels, type Role } from "@/lib/auth/roles";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "10px 12px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface,
  color: theme.color.text,
  fontSize: 15,
};

const labelStyle: React.CSSProperties = {
  fontSize: theme.font.size.sm,
  color: theme.color.text,
  fontWeight: 500,
  display: "block",
  marginBottom: theme.space(3),
};

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `trilha-${rowKeyCounter}`;
}

interface TrilhaRow {
  key: string;
  program_id: string;
  track_id: string;
}

function TrilhaRowFields({
  row,
  programs,
  onChange,
  onRemove,
  canRemove,
}: {
  row: TrilhaRow;
  programs: Program[];
  onChange: (patch: Partial<TrilhaRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Cada Programa pode ter (ou não) funções/cargos — Fase 1 por função é
  // uma possibilidade do Programa, não garantia.
  useEffect(() => {
    if (!row.program_id) {
      setTracks([]);
      return;
    }
    let cancelled = false;
    setLoadingTracks(true);
    fetch(`/api/admin/tracks?programId=${encodeURIComponent(row.program_id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTracks(data.ok ? (data.tracks as Track[]) : []);
      })
      .catch(() => {
        if (!cancelled) setTracks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTracks(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.program_id]);

  return (
    <div
      style={{
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: theme.space(3),
        marginBottom: theme.space(3),
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, fontWeight: 600 }}>TRILHA</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              background: "transparent",
              border: "none",
              color: theme.color.danger,
              fontSize: theme.font.size.xs,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Remover
          </button>
        )}
      </div>

      <label style={{ ...labelStyle, marginBottom: 8 }}>
        Programa *
        <select
          required
          style={inputStyle}
          value={row.program_id}
          onChange={(e) => onChange({ program_id: e.target.value, track_id: "" })}
        >
          <option value="">Selecione...</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      {loadingTracks && (
        <p style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: 0 }}>
          Carregando funções deste Programa...
        </p>
      )}

      {!loadingTracks && tracks && tracks.length > 0 && (
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          Função
          <select required style={inputStyle} value={row.track_id} onChange={(e) => onChange({ track_id: e.target.value })}>
            <option value="">Selecione...</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function NewUserForm({ programs }: { programs: Program[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    nome_completo: "",
    matricula: "",
    login: "",
    password: "",
    cd: "",
    turno: "",
    status: "active" as "active" | "inactive",
    role: "student" as Role,
  });
  const [trilhas, setTrilhas] = useState<TrilhaRow[]>([
    { key: nextRowKey(), program_id: programs[0]?.id ?? "", track_id: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateTrilha(key: string, patch: Partial<TrilhaRow>) {
    setTrilhas((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  function addTrilha() {
    setTrilhas((prev) => [...prev, { key: nextRowKey(), program_id: "", track_id: "" }]);
  }

  function removeTrilha(key: string) {
    setTrilhas((prev) => prev.filter((t) => t.key !== key));
  }

  const isStudent = form.role === "student";
  const trilhasValidas = !isStudent || trilhas.every((t) => t.program_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_completo: form.nome_completo,
          matricula: form.matricula || null,
          login: form.login,
          password: form.password,
          role: form.role,
          enrollments: isStudent ? trilhas.map((t) => ({ program_id: t.program_id, track_id: t.track_id || null })) : [],
          cd: form.cd || null,
          turno: form.turno || null,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível criar o usuário.");
        return;
      }
      router.push(`/admin/usuarios/${data.user.id}`);
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>
          Nome completo *
          <input
            required
            style={inputStyle}
            value={form.nome_completo}
            onChange={(e) => update("nome_completo", e.target.value)}
          />
        </label>

        <label style={labelStyle}>
          Matrícula
          <input style={inputStyle} value={form.matricula} onChange={(e) => update("matricula", e.target.value)} />
        </label>

        <label style={labelStyle}>
          Login *
          <input
            required
            style={inputStyle}
            value={form.login}
            onChange={(e) => update("login", e.target.value)}
            autoComplete="off"
          />
        </label>

        <label style={labelStyle}>
          Senha *
          <input
            required
            minLength={6}
            type="text"
            style={inputStyle}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            autoComplete="new-password"
          />
        </label>

        <label style={labelStyle}>
          Perfil *
          <select style={inputStyle} value={form.role} onChange={(e) => update("role", e.target.value as Role)}>
            {(["student", "viewer", "analyst", "admin"] as Role[]).map((r) => (
              <option key={r} value={r}>
                {roleLabels[r]}
              </option>
            ))}
          </select>
        </label>

        {isStudent ? (
          <>
            <span style={{ ...labelStyle, marginBottom: 8 }}>Trilhas *</span>
            {trilhas.map((row) => (
              <TrilhaRowFields
                key={row.key}
                row={row}
                programs={programs}
                onChange={(patch) => updateTrilha(row.key, patch)}
                onRemove={() => removeTrilha(row.key)}
                canRemove={trilhas.length > 1}
              />
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={addTrilha}
              disabled={programs.length === 0}
              style={{ marginBottom: theme.space(4) }}
            >
              + Adicionar trilha
            </Button>
          </>
        ) : (
          <p
            style={{
              fontSize: theme.font.size.sm,
              color: theme.color.infoText,
              background: theme.color.infoBg,
              borderRadius: theme.radius.md,
              padding: "10px 12px",
              marginBottom: theme.space(4),
            }}
          >
            {form.role === "viewer" &&
              "Vê todos os Programas e módulos liberados, sem precisar de trilha. Nada que fizer é registrado."}
            {form.role === "analyst" &&
              "Vê todos os Programas e módulos liberados (sem registrar nada) e acessa os Indicadores em modo leitura."}
            {form.role === "admin" && "Acesso a tudo: painel do gestor completo e visão de todos os Programas."}
          </p>
        )}

        <label style={labelStyle}>
          CD/Galpão
          <input style={inputStyle} value={form.cd} onChange={(e) => update("cd", e.target.value)} />
        </label>

        <label style={labelStyle}>
          Turno
          <input style={inputStyle} value={form.turno} onChange={(e) => update("turno", e.target.value)} />
        </label>

        <label style={{ ...labelStyle, marginBottom: theme.space(5) }}>
          Status
          <select
            style={inputStyle}
            value={form.status}
            onChange={(e) => update("status", e.target.value as "active" | "inactive")}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </label>

        {error && (
          <p
            role="alert"
            style={{
              color: theme.color.danger,
              background: theme.color.dangerBg,
              borderRadius: theme.radius.sm,
              padding: "8px 12px",
              fontSize: theme.font.size.sm,
              marginBottom: theme.space(4),
            }}
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading || programs.length === 0 || !trilhasValidas} fullWidth>
          {loading ? "Criando..." : "Criar usuário"}
        </Button>
      </form>
    </Card>
  );
}
