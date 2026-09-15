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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
}

/**
 * Renderiza apenas o subconjunto de Markdown usado nas respostas do
 * assistente: negrito, listas simples, parágrafos e quebras de linha.
 * Não usa HTML bruto nem dangerouslySetInnerHTML.
 */
function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderAssistantText(text: string) {
  const lines = text.split(/\r?\n/);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={index} style={{ height: 4 }} />;
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)$/);

        if (bullet) {
          return (
            <div key={index} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
              <span aria-hidden="true">•</span>
              <span>{renderInlineMarkdown(bullet[1])}</span>
            </div>
          );
        }

        return <div key={index}>{renderInlineMarkdown(trimmed)}</div>;
      })}
    </div>
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

      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: data.answer }]);
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
          className="assistant-chat-panel"
          role="dialog"
          aria-label="Assistente Shopper Trilha"
          style={{
            position: "fixed",
            bottom: 88,
            right: 16,
            left: 16,
            maxWidth: 380,
            marginLeft: "auto",
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
            className="assistant-chat-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: theme.color.primary,
              color: "#fff",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/*
                eslint-disable-next-line @next/next/no-img-element --
                objectFit: "contain" (não "cover") preserva o mascote
                inteiro sem cortar cabeça/antena/laterais. Sem
                borderRadius/clip — assim que a imagem em
                public/assistant-mascot.png tiver fundo transparente de
                verdade, aparece só o mascote, sem círculo/fundo branco.
              */}
              <img
                src="/assistant-mascot.png"
                alt=""
                width={32}
                height={32}
                style={{ objectFit: "contain", display: "block" }}
              />
              <span style={{ fontSize: theme.font.size.base, fontWeight: 700 }}>Assistente Shopper Trilha</span>
            </span>
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
          <div className="assistant-chat-messages" ref={listRef} style={{ flex: "1 1 auto", overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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
                {m.role === "assistant" && !m.error ? renderAssistantText(m.text) : m.text}
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
          <div className="assistant-chat-input" style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${theme.color.border}` }}>
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
          width: 64,
          height: 64,
          border: "none",
          padding: 0,
          // Sem background/overflow:hidden — nada de círculo por trás do
          // mascote. Assim que a imagem tiver transparência de verdade,
          // só o mascote aparece flutuando, como pedido.
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 900,
        }}
      >
        {/*
          eslint-disable-next-line @next/next/no-img-element --
          objectFit: "contain" preserva a proporção e o mascote inteiro
          (cabeça, antena, laterais) sem cortar nada — diferente do
          "cover" anterior, que recortava pra preencher um círculo.
          drop-shadow (não box-shadow) segue o contorno real do mascote
          em vez de desenhar uma sombra retangular/circular atrás dele.
        */}
        <img
          src="/assistant-mascot.png"
          alt=""
          width={64}
          height={64}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 4px 10px rgba(15, 23, 20, 0.35))",
          }}
        />
      </button>

      <style jsx global>{`
        .assistant-chat-panel {
          height: min(70dvh, 560px);
        }

        @media (max-width: 600px) {
          .assistant-chat-panel {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            max-width: none !important;
            height: 100dvh !important;
            max-height: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }

          .assistant-chat-panel .assistant-chat-header {
            flex: 0 0 auto;
          }

          .assistant-chat-panel .assistant-chat-messages {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }

          .assistant-chat-panel .assistant-chat-input {
            flex: 0 0 auto;
            padding-bottom: calc(10px + env(safe-area-inset-bottom));
            background: white;
          }
        }
      `}</style>
    </>
  );
}
