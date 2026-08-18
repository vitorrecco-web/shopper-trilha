"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UserProgress } from "@/lib/services/userProgress";

export interface UserRow {
  id: string;
  nome_completo: string;
  matricula: string | null;
  login: string;
  track_nome: string;
  cd: string | null;
  turno: string | null;
  status: "active" | "inactive";
  last_login_at: string | null;
  progress: UserProgress;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatProgress(p: UserProgress): string {
  if (p.percent === null) return "—";
  return `${p.percent}% (${p.completedModules}/${p.totalModules})`;
}

/**
 * Colunas conforme §13 do PROJECT_CONTEXT: Nome, Matrícula, Trilha, CD,
 * Turno, Progresso, Status, Último acesso. Ativar/Inativar direto na
 * linha, sem precisar entrar no detalhe (ação principal listada em §13).
 */
export function UsersTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nome_completo.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q) ||
        (u.matricula ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  async function toggleStatus(user: UserRow) {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    setPendingId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível alterar o status.");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <input
        placeholder="Buscar por nome, login ou matrícula..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #2a2d34",
          background: "#181a1f",
          color: "#f2f2f2",
          fontSize: 14,
          marginBottom: 12,
        }}
      />

      {error && (
        <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>
          {error}
        </p>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #22252b", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ background: "#181a1f", textAlign: "left" }}>
              {["Nome", "Matrícula", "Trilha", "CD", "Turno", "Progresso", "Status", "Último acesso", ""].map(
                (h) => (
                  <th key={h} style={{ padding: "10px 12px", color: "#9aa0a6", fontWeight: 500 }}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid #22252b" }}>
                <td style={{ padding: "10px 12px" }}>
                  <Link href={`/admin/usuarios/${u.id}`} style={{ color: "#4ECDC4", textDecoration: "none" }}>
                    {u.nome_completo}
                  </Link>
                </td>
                <td style={{ padding: "10px 12px", color: "#9aa0a6" }}>{u.matricula ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{u.track_nome}</td>
                <td style={{ padding: "10px 12px", color: "#9aa0a6" }}>{u.cd ?? "—"}</td>
                <td style={{ padding: "10px 12px", color: "#9aa0a6" }}>{u.turno ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{formatProgress(u.progress)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      background: u.status === "active" ? "#0f3d33" : "#3d1f1f",
                      color: u.status === "active" ? "#4ECDC4" : "#ff8a8a",
                    }}
                  >
                    {u.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "#9aa0a6" }}>{formatDate(u.last_login_at)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <button
                    onClick={() => toggleStatus(u)}
                    disabled={pendingId === u.id}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #2a2d34",
                      background: "transparent",
                      color: "#f2f2f2",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {u.status === "active" ? "Inativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 16, textAlign: "center", color: "#9aa0a6" }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
