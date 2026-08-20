"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Track } from "@/lib/db/types";
import { theme } from "@/lib/ui/theme";
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

export function NewUserForm({ tracks }: { tracks: Track[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    nome_completo: "",
    matricula: "",
    login: "",
    password: "",
    track_id: tracks[0]?.id ?? "",
    cd: "",
    turno: "",
    status: "active" as "active" | "inactive",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
          track_id: form.track_id,
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
          Trilha/Função *
          <select
            required
            style={inputStyle}
            value={form.track_id}
            onChange={(e) => update("track_id", e.target.value)}
            disabled={tracks.length === 0}
          >
            {tracks.length === 0 && <option value="">Nenhuma trilha ativa</option>}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>

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

        <Button type="submit" disabled={loading || tracks.length === 0} fullWidth>
          {loading ? "Criando..." : "Criar usuário"}
        </Button>
      </form>
    </Card>
  );
}
