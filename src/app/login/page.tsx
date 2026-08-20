"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/ui/theme";
import { Logo } from "@/components/ui/Logo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        setLoading(false);
        return;
      }

      router.push(data.role === "admin" ? "/admin" : "/app");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.space(4),
        background: theme.color.bg,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: theme.space(6) }}>
          <Logo height={40} />
        </div>

        <Card style={{ padding: theme.space(6) }}>
          <h1
            style={{
              fontSize: theme.font.size.xl,
              margin: 0,
              marginBottom: 4,
              color: theme.color.text,
              textAlign: "center",
            }}
          >
            Shopper Trilha
          </h1>
          <p
            style={{
              color: theme.color.textMuted,
              fontSize: theme.font.size.sm,
              marginTop: 0,
              marginBottom: theme.space(5),
              textAlign: "center",
            }}
          >
            Entre com seu login e senha.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: theme.space(4) }}>
            <label style={{ fontSize: theme.font.size.sm, color: theme.color.text, fontWeight: 500 }}>
              Login
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                required
                style={inputStyle}
              />
            </label>

            <label style={{ fontSize: theme.font.size.sm, color: theme.color.text, fontWeight: 500 }}>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={inputStyle}
              />
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
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} fullWidth style={{ marginTop: theme.space(1) }}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Card>

        <p
          style={{
            textAlign: "center",
            color: theme.color.textFaint,
            fontSize: theme.font.size.xs,
            marginTop: theme.space(5),
          }}
        >
          Shopper — Trilha de capacitação de supervisores
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "11px 14px",
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface,
  color: theme.color.text,
  fontSize: 15,
};
