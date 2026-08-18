"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UserProgress } from "@/lib/services/userProgress";
import type { TrackStatus } from "@/lib/services/trackStatus";
import { trackStatusLabel } from "@/lib/services/trackStatus";

export interface UserRow {
  id: string;
  nome_completo: string;
  matricula: string | null;
  login: string;
  track_id: string | null;
  track_nome: string;
  cd: string | null;
  turno: string | null;
  status: "active" | "inactive";
  last_login_at: string | null;
  progress: UserProgress;
  trackStatus: TrackStatus;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatProgress(p: UserProgress): string {
  if (p.percent === null) return "—";
  return `${p.percent}% (${p.completedModules}/${p.totalModules})`;
}

const trackStatusColor: Record<TrackStatus, { bg: string; fg: string }> = {
  sem_modulos: { bg: "#22252b", fg: "#9aa0a6" },
  nao_iniciado: { bg: "#2a2417", fg: "#e0b34d" },
  em_andamento: { bg: "#141a30", fg: "#7F77DD" },
  concluida: { bg: "#0f3d33", fg: "#4ECDC4" },
};

/**
 * Colunas conforme §13 do PROJECT_CONTEXT: Nome, Matrícula, Trilha, CD,
 * Turno, Progresso, Status, Último acesso. Ativar/Inativar direto na
 * linha, sem precisar entrar no detalhe (ação principal listada em §13).
 * "Status da trilha" (Fase 10, tarefa 5) é calculado — nunca lido de
 * uma flag salva (§12).
 */
export function UsersTable({ initialUsers, tracks }: { initialUsers: UserRow[]; tracks: { id: string; nome: string }[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (trackFilter && u.track_id !== trackFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.nome_completo.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q) ||
        (u.matricula ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, trackFilter, statusFilter]);

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

  const selectStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #2a2d34",
    background: "#181a1f",
    color: "#f2f2f2",
    fontSize: 13,
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          placeholder="Buscar por nome, login ou matrícula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...selectStyle, width: "100%", maxWidth: 320 }}
        />
        <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} style={selectStyle}>
          <option value="">Todas as trilhas</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {error && (
        <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 8 }}>
          {error}
        </p>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #22252b", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
          <thead>
            <tr style={{ background: "#181a1f", textAlign: "left" }}>
              {[
                "Nome",
                "Matrícula",
                "Trilha",
                "CD",
                "Turno",
                "Progresso",
                "Status da trilha",
                "Conta",
                "Último acesso",
                "",
              ].map((h) => (
                <th key={h} style={{ padding: "10px 12px", color: "#9aa0a6", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const ts = trackStatusColor[u.trackStatus];
              return (
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
                        background: ts.bg,
                        color: ts.fg,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {trackStatusLabel[u.trackStatus]}
                    </span>
                  </td>
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
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 16, textAlign: "center", color: "#9aa0a6" }}>
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
