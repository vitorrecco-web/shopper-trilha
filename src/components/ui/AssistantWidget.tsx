"use client";

import { useEffect, useRef, useState } from "react";
import { theme } from "@/lib/ui/theme";

/**
 * Botão flutuante + painel de chat do Assistente Shopper Trilha.
 * Histórico da conversa fica só em memória (state React) — reinicia se
 * a página recarregar, como pedido ("enquanto a página estiver aberta").
 *
 * z-index 900: abaixo do Modo de Estudo (FocusOverlay, 1000) para nunca
 * competir visualmente quando um PDF/vídeo está ampliado, mas acima do
 * conteúdo normal da página. Fica no canto inferior direito — não
 * sobrepõe o Header (topo) nem nenhuma navegação existente.
 */

interface ChatSource {
  arquivo: string;
  caminho: string;
  categoria: string;
  pagina: number | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
  error?: boolean;
}

function RobotIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="16" height="12" rx="3" stroke="white" strokeWidth="1.8" />
      <circle cx="9" cy="14" r="1.4" fill="white" />
      <circle cx="15" cy="14" r="1.4" fill="white" />
      <path d="M12 8V5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="3.6" r="1.2" fill="white" />
      <path d="M2 13h2M20 13h2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  async function handleSend() {
    const question = input.trim();
    if (!question || sending) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/assistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", text: data.error ?? "Não foi possível responder agora.", error: true },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: data.answer, sources: data.sources ?? [] },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: "Erro de conexão. Tente novamente.", error: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Assistente Shopper Trilha"
          style={{
            position: "fixed",
            bottom: 88,
            right: 16,
            left: 16,
            maxWidth: 380,
            marginLeft: "auto",
            height: "min(70dvh, 560px)",
            background: theme.color.surface,
            borderRadius: theme.radius.lg,
            boxShadow: "0 8px 32px rgba(15, 23, 20, 0.22)",
            border: `1px solid ${theme.color.border}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 900,
          }}
        >
          {/* Cabeçalho */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: theme.color.primary,
              color: "#fff",
            }}
          >
            <span style={{ fontSize: theme.font.size.base, fontWeight: 700 }}>Assistente Shopper Trilha</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 20,
                lineHeight: 1,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* Mensagens */}
          <div ref={listRef} style={{ flex: "1 1 auto", overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
                Pergunte algo sobre os documentos da Trilha de Liderança (políticas, liderança, etc). Eu só respondo
                com base no que está nesses documentos.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  padding: "10px 12px",
                  borderRadius: theme.radius.md,
                  background: m.role === "user" ? theme.color.primaryLight : m.error ? theme.color.dangerBg : theme.color.bg,
                  border: `1px solid ${m.error ? theme.color.danger : theme.color.border}`,
                  fontSize: theme.font.size.sm,
                  color: theme.color.text,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.text}
                {m.sources && m.sources.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.color.border}` }}>
                    <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, margin: "0 0 4px" }}>Fontes:</p>
                    {m.sources.map((s, i) => (
                      <p key={i} style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: "2px 0" }}>
                        📄 {s.caminho}
                        {s.pagina != null && ` (página ${s.pagina})`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 12px",
                  borderRadius: theme.radius.md,
                  background: theme.color.bg,
                  border: `1px solid ${theme.color.border}`,
                  fontSize: theme.font.size.sm,
                  color: theme.color.textMuted,
                }}
              >
                Pensando...
              </div>
            )}
          </div>

          {/* Entrada */}
          <div style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${theme.color.border}` }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta..."
              rows={1}
              aria-label="Sua pergunta para o assistente"
              style={{
                flex: "1 1 auto",
                resize: "none",
                padding: "10px 12px",
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.color.border}`,
                fontSize: theme.font.size.sm,
                fontFamily: "inherit",
                maxHeight: 90,
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label="Enviar pergunta"
              style={{
                padding: "0 16px",
                borderRadius: theme.radius.md,
                border: "none",
                background: theme.color.primary,
                color: "#fff",
                fontWeight: 700,
                fontSize: theme.font.size.sm,
                cursor: sending || !input.trim() ? "default" : "pointer",
                opacity: sending || !input.trim() ? 0.5 : 1,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar assistente" : "Abrir Assistente Shopper Trilha"}
        aria-expanded={open}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: theme.radius.pill,
          border: "none",
          background: theme.color.primary,
          boxShadow: "0 4px 14px rgba(31, 169, 122, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 900,
        }}
      >
        <RobotIcon />
      </button>
    </>
  );
}
