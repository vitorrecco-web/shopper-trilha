"use client";

import { useEffect, useRef } from "react";
import { theme } from "@/lib/ui/theme";

/**
 * "Modo de Estudo" — casca genérica de visualização ampliada, reutilizada
 * tanto pelo PDF quanto pelo vídeo (nenhum dos dois renderizadores é
 * duplicado: `children` é SEMPRE montado, seja no modo normal ou
 * ampliado — só a CSS em volta muda). Isso é o que preserva a página
 * atual do PDF e o tempo do vídeo ao entrar/sair do modo ampliado, sem
 * precisar de nenhuma lógica extra de "salvar e restaurar estado": o
 * componente React por trás nunca desmonta.
 *
 * Fecha com ESC (desktop), trava o scroll do body enquanto aberto, e
 * fica acima do Header (z-index).
 */
export function FocusOverlay({
  expanded,
  onRequestClose,
  children,
  overlayControls,
  footer,
  ariaLabel,
}: {
  expanded: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  /** Setas/controles extras mostrados só quando ampliado (ex: navegação de página do PDF). */
  overlayControls?: React.ReactNode;
  /** Ex: "Página X de Y", mostrado discretamente na parte inferior quando ampliado. */
  footer?: React.ReactNode;
  ariaLabel: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded) return;

    document.body.classList.add("focus-overlay-open");
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onRequestClose();
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("focus-overlay-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded, onRequestClose]);

  return (
    <div
      style={
        expanded
          ? {
              position: "fixed",
              inset: 0,
              zIndex: 1000, // acima do Header (zIndex: 10)
              background: "rgba(20, 22, 20, 0.92)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
            }
          : { position: "relative" }
      }
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? ariaLabel : undefined}
    >
      <div
        style={
          expanded
            ? {
                position: "relative",
                width: "100%",
                height: "100%",
                maxWidth: 1100,
                maxHeight: "calc(100dvh - 24px)",
                display: "flex",
                flexDirection: "column",
              }
            : { width: "100%" }
        }
      >
        {children}

        {expanded && overlayControls}

        {expanded && footer && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 0,
              right: 0,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.75)",
                background: "rgba(0,0,0,0.35)",
                padding: "3px 10px",
                borderRadius: theme.radius.pill,
              }}
            >
              {footer}
            </span>
          </div>
        )}
      </div>

      {expanded && (
        <button
          ref={closeButtonRef}
          onClick={onRequestClose}
          aria-label="Fechar visualização ampliada"
          style={{
            position: "fixed",
            top: 14,
            right: 14,
            width: 40,
            height: 40,
            borderRadius: theme.radius.pill,
            border: "none",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            zIndex: 1001,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Botão discreto "⛶ Ampliar", mostrado só no modo normal (não ampliado). */
export function ExpandButton({ onClick, label = "Ampliar" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 10px",
        borderRadius: theme.radius.pill,
        border: "none",
        background: "rgba(20, 22, 20, 0.55)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        zIndex: 2,
      }}
    >
      ⛶ {label}
    </button>
  );
}
