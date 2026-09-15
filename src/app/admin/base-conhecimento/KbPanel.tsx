"use client";

import { useEffect, useState } from "react";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface KbDocumentSummary {
  id: string;
  nome: string;
  caminho: string;
  categoria: string;
  pageCount: number | null;
  lastIndexedAt: string | null;
  error: string | null;
}

interface KbSyncSummary {
  novos: number;
  atualizados: number;
  inalterados: number;
  removidos: number;
  comErro: number;
  naoSuportados: number;
}

interface StatusResult {
  ok: boolean;
  lastSync: { status: string; started_at: string; completed_at: string | null; summary: unknown } | null;
  documents: KbDocumentSummary[];
  error?: string;
}

interface SearchResultItem {
  chunkId: string;
  documentId: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  arquivo: string;
  caminho: string;
  categoria: string;
  score: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
  marginBottom: theme.space(4),
};

export function KbPanel() {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; summary?: KbSyncSummary; error?: string } | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/kb/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ ok: false, lastSync: null, documents: [], error: "Erro de conexão." });
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/kb/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      await loadStatus();
    } catch {
      setSyncResult({ ok: false, error: "Erro de conexão." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res = await fetch("/api/admin/kb/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK: 8 }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSearchError(data.error ?? "Não foi possível buscar agora.");
        return;
      }
      setSearchResults(data.results);
    } catch {
      setSearchError("Erro de conexão.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      {/* Sincronização */}
      <div style={boxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, color: theme.color.text }}>Sincronização</h2>
            <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginTop: 4, marginBottom: 0 }}>
              Última execução:{" "}
              {loadingStatus
                ? "carregando..."
                : status?.lastSync
                  ? `${formatDate(status.lastSync.started_at)} — ${status.lastSync.status}`
                  : "nunca"}
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? "Sincronizando... (pode demorar)" : "Sincronizar base de conhecimento"}
          </Button>
        </div>

        {syncResult && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: theme.radius.md,
              background: syncResult.ok ? theme.color.primaryLight : theme.color.dangerBg,
              fontSize: theme.font.size.sm,
            }}
          >
            {syncResult.ok && syncResult.summary ? (
              <span style={{ color: theme.color.text }}>
                Novos: <b>{syncResult.summary.novos}</b> · Atualizados: <b>{syncResult.summary.atualizados}</b> ·
                Inalterados: <b>{syncResult.summary.inalterados}</b> · Removidos: <b>{syncResult.summary.removidos}</b> ·
                Com erro: <b>{syncResult.summary.comErro}</b> · Não suportados: <b>{syncResult.summary.naoSuportados}</b>
              </span>
            ) : (
              <span style={{ color: theme.color.danger }}>{syncResult.error}</span>
            )}
          </div>
        )}
      </div>

      {/* Documentos indexados */}
      <div style={boxStyle}>
        <h2 style={{ fontSize: theme.font.size.md, marginTop: 0, marginBottom: 12, color: theme.color.text }}>
          Documentos ativos {status && `(${status.documents.length})`}
        </h2>
        {loadingStatus ? (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>Carregando...</p>
        ) : status && status.documents.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {status.documents.map((doc) => (
              <div key={doc.id} style={{ fontSize: 13, borderTop: `1px solid ${theme.color.border}`, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: theme.color.text, fontWeight: 600 }}>{doc.caminho}</span>
                  <Badge tone="neutral">{doc.categoria}</Badge>
                </div>
                <div style={{ color: theme.color.textMuted, marginTop: 2 }}>
                  {doc.pageCount ? `${doc.pageCount} páginas` : "—"} · indexado em {formatDate(doc.lastIndexedAt)}
                </div>
                {doc.error && (
                  <div style={{ color: theme.color.danger, marginTop: 4 }}>⚠ {doc.error}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
            Nenhum documento indexado ainda — rode a sincronização acima.
          </p>
        )}
      </div>

      {/* Teste de busca semântica */}
      <div style={boxStyle}>
        <h2 style={{ fontSize: theme.font.size.md, marginTop: 0, marginBottom: 12, color: theme.color.text }}>
          Testar busca semântica
        </h2>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: quantos dias de férias um colaborador tem direito?"
            style={{
              flex: "1 1 260px",
              padding: "10px 12px",
              borderRadius: theme.radius.md,
              border: `1px solid ${theme.color.border}`,
              fontSize: 14,
            }}
          />
          <Button type="submit" disabled={searching || !query.trim()}>
            {searching ? "Buscando..." : "Buscar"}
          </Button>
        </form>

        {searchError && (
          <p role="alert" style={{ color: theme.color.danger, fontSize: 13, marginBottom: 12 }}>
            {searchError}
          </p>
        )}

        {searchResults && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {searchResults.length === 0 && (
              <p style={{ fontSize: 13, color: theme.color.textMuted }}>Nenhum resultado encontrado.</p>
            )}
            {searchResults.map((r) => (
              <div
                key={r.chunkId}
                style={{
                  padding: 12,
                  borderRadius: theme.radius.md,
                  background: theme.color.bg,
                  border: `1px solid ${theme.color.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.color.text }}>{r.caminho}</span>
                  <span style={{ fontSize: 12, color: theme.color.primaryDark, fontWeight: 700 }}>
                    score {r.score.toFixed(3)}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: theme.color.text, margin: 0, whiteSpace: "pre-wrap" }}>{r.content}</p>
                <p style={{ fontSize: 11.5, color: theme.color.textFaint, marginTop: 6, marginBottom: 0 }}>
                  {r.categoria}
                  {r.pageStart != null && (r.pageStart === r.pageEnd ? ` · página ${r.pageStart}` : ` · páginas ${r.pageStart}-${r.pageEnd}`)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
