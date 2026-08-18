"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Shopper Trilha</h1>
        <p style={{ color: "#9aa0a6", fontSize: 13, marginTop: 0, marginBottom: 8 }}>
          Entre com seu login e senha.
        </p>

        <label style={{ fontSize: 13 }}>
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

        <label style={{ fontSize: 13 }}>
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
          <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #2a2d34",
  background: "#181a1f",
  color: "#f2f2f2",
  fontSize: 15,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "12px 16px",
  borderRadius: 8,
  border: "none",
  background: "#4ECDC4",
  color: "#0f1115",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
};
