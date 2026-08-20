"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { theme } from "@/lib/ui/theme";

/**
 * Handle exposto via ref — permite que o Modo de Estudo (FocusOverlay)
 * tenha suas próprias setas ‹ › sobrepostas sem duplicar o leitor: as
 * setas do overlay chamam estas mesmas funções, controlando a MESMA
 * instância do visualizador (nunca desmonta ao entrar/sair do modo
 * ampliado, o que preserva a página atual automaticamente).
 */
export interface PdfPageViewerHandle {
  goPrev: () => void;
  goNext: () => void;
  /** Força um novo render da página atual no tamanho do container — usado depois de expandir/recolher, quando o container muda de tamanho sem disparar 'resize' da janela. */
  refit: () => void;
}

/**
 * Visualizador próprio de PDF: mostra 1 página por vez, centralizada e
 * ajustada à largura disponível, sem a toolbar/miniaturas nativas do
 * navegador (que era o problema do <iframe> anterior).
 *
 * A busca do PDF continua sendo feita via `fetch()` na MESMA rota
 * privada de sempre (`/api/modulos/[id]/pdf`) — nada mudou na
 * autorização nem nos efeitos colaterais do servidor (material_accessed,
 * conclusão sem quiz, etc). O `onLoaded` abaixo dispara exatamente no
 * mesmo momento em que o antigo `<iframe onLoad>` disparava: quando essa
 * busca é concluída com sucesso.
 */
export const PdfPageViewer = forwardRef<
  PdfPageViewerHandle,
  {
    moduleId: string;
    onLoaded?: () => void;
    /** Chamado sempre que a página atual ou o total mudam — o Modo de Estudo usa isto para mostrar "Página X de Y" e habilitar/desabilitar suas próprias setas. */
    onPageChange?: (current: number, total: number) => void;
    /** Oculta o "Página X de Y" e os botões Anterior/Próxima internos — usado quando o Modo de Estudo já mostra sua própria navegação sobreposta, para não duplicar. */
    hideControls?: boolean;
    /**
     * Quando true, a página usa o máximo de LARGURA e ALTURA disponíveis
     * simultaneamente (fit "contain"), porque o container tem uma altura
     * própria e intencional — é o caso do Modo de Estudo.
     * Quando false (padrão — uso normal, fora do Modo de Estudo), o
     * ajuste é só pela largura, como sempre foi: a altura do container
     * nesse modo é incidental (decorrente do conteúdo), não intencional,
     * e usá-la para escalar produzia páginas minúsculas dentro de uma
     * área branca grande — essa era a regressão a corrigir.
     */
    fitAvailableHeight?: boolean;
  }
>(function PdfPageViewer({ moduleId, onLoaded, onPageChange, hideControls, fitAvailableHeight = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const notifiedRef = useRef(false);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega o documento uma única vez por módulo.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // O worker é servido como arquivo estático em public/ (copiado de
        // node_modules/pdfjs-dist/build/ via scripts/copy-pdf-worker.mjs,
        // que roda automaticamente no postinstall). Deliberadamente NÃO
        // usamos o padrão `new URL(..., import.meta.url)` — isso faz o
        // webpack "adotar" o arquivo como módulo e tentar minificá-lo
        // (Terser), o que quebra porque o worker é ESM (import/export) e
        // o Terser tenta tratá-lo como script comum.
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // Esta chamada É o "primeiro acesso" — mesma rota privada e
        // mesma autorização de antes (módulo aplicável + liberado). O
        // aluno nunca vê a URL/ID do Google Drive: só recebe os bytes
        // do PDF, aqui, já depois de todo o efeito colateral no servidor.
        const res = await fetch(`/api/modulos/${moduleId}/pdf`);
        if (!res.ok) throw new Error("not-ok");
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);

        if (!notifiedRef.current) {
          notifiedRef.current = true;
          onLoaded?.();
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar o material. Tente recarregar a página.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const renderPage = useCallback(
    async (pageNumber: number) => {
      const pdf = pdfDocRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!pdf || !canvas || !container) return;

      setRendering(true);
      try {
        const page = await pdf.getPage(pageNumber);
        const containerWidth = container.clientWidth || 320;
        const baseViewport = page.getViewport({ scale: 1 });
        const scaleByWidth = containerWidth / baseViewport.width;

        // Só usa a altura do container como segundo limite no Modo de
        // Estudo (fitAvailableHeight=true), onde essa altura é
        // intencional (o overlay ocupa quase a tela toda). No modo
        // normal, a altura do container é incidental — usá-la aqui era
        // exatamente a causa da página aparecer minúscula numa área
        // branca grande.
        let scale = scaleByWidth;
        if (fitAvailableHeight) {
          const containerHeight = container.clientHeight;
          if (containerHeight > 0) {
            scale = Math.min(scaleByWidth, containerHeight / baseViewport.height);
          }
        }

        const viewport = page.getViewport({ scale });

        const context = canvas.getContext("2d");
        if (!context) return;

        // Ajusta para telas de alta densidade (retina) sem perder nitidez.
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        await page.render({ canvasContext: context, viewport, transform }).promise;
      } finally {
        setRendering(false);
      }
    },
    [fitAvailableHeight]
  );

  useEffect(() => {
    if (!loading && numPages > 0) renderPage(currentPage);
  }, [currentPage, loading, numPages, renderPage]);

  useEffect(() => {
    onPageChange?.(currentPage, numPages);
  }, [currentPage, numPages, onPageChange]);

  // Reajusta a página quando a janela é redimensionada OU o aparelho
  // gira (orientationchange) — dupla requestAnimationFrame espera o
  // layout assentar antes de medir o container de novo (no iOS, as
  // dimensões durante o próprio evento de rotação ainda podem refletir
  // a orientação antiga por um instante).
  useEffect(() => {
    function scheduleRefit() {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!loading && numPages > 0) renderPage(currentPage);
        });
      });
    }
    window.addEventListener("resize", scheduleRefit);
    window.addEventListener("orientationchange", scheduleRefit);
    return () => {
      window.removeEventListener("resize", scheduleRefit);
      window.removeEventListener("orientationchange", scheduleRefit);
    };
  }, [currentPage, loading, numPages, renderPage]);

  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setCurrentPage((p) => Math.min(numPages || p, p + 1)), [numPages]);

  useImperativeHandle(
    ref,
    () => ({
      goPrev,
      goNext,
      refit: () => renderPage(currentPage),
    }),
    [goPrev, goNext, renderPage, currentPage]
  );

  // Navegação pelas setas do teclado (usa updates funcionais — sem closure velha).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

  if (error) {
    return (
      <p role="alert" style={{ color: theme.color.danger, fontSize: 13 }}>
        {error}
      </p>
    );
  }

  const isFirst = currentPage <= 1;
  const isLast = numPages > 0 && currentPage >= numPages;

  return (
    <div
      style={
        fitAvailableHeight
          ? { width: "100%", height: "100%", display: "flex", flexDirection: "column" }
          : undefined
      }
    >
      <div
        ref={containerRef}
        style={{
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadow.sm,
          overflow: "hidden",
          background: "#fff",
          display: "flex",
          justifyContent: "center",
          alignItems: fitAvailableHeight ? "center" : undefined,
          minHeight: loading ? 220 : undefined,
          ...(fitAvailableHeight ? { flex: "1 1 auto", minHeight: 0 } : {}),
        }}
      >
        {loading ? (
          <p style={{ color: theme.color.textMuted, fontSize: 13, alignSelf: "center", padding: 40, margin: 0 }}>
            Carregando material...
          </p>
        ) : (
          <canvas ref={canvasRef} style={{ display: "block" }} />
        )}
      </div>

      {!hideControls && !loading && numPages > 0 && (
        <>
          <p style={{ textAlign: "center", fontSize: 13, color: theme.color.textMuted, margin: "10px 0" }}>
            {rendering ? "Carregando página..." : `Página ${currentPage} de ${numPages}`}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              onClick={goPrev}
              disabled={isFirst}
              style={{
                padding: "12px 22px",
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.color.border}`,
                background: isFirst ? theme.color.bg : theme.color.surface,
                color: isFirst ? theme.color.textFaint : theme.color.text,
                fontSize: 14,
                fontWeight: 600,
                cursor: isFirst ? "default" : "pointer",
                minHeight: 44,
              }}
            >
              ← Anterior
            </button>
            <button
              onClick={goNext}
              disabled={isLast}
              style={{
                padding: "12px 22px",
                borderRadius: theme.radius.md,
                border: "none",
                background: isLast ? theme.color.border : theme.color.primary,
                color: isLast ? theme.color.textFaint : "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: isLast ? "default" : "pointer",
                minHeight: 44,
              }}
            >
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  );
});
