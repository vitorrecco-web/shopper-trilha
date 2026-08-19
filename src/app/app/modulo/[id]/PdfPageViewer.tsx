"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

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
export function PdfPageViewer({ moduleId, onLoaded }: { moduleId: string; onLoaded?: () => void }) {
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

  const renderPage = useCallback(async (pageNumber: number) => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdf || !canvas || !container) return;

    setRendering(true);
    try {
      const page = await pdf.getPage(pageNumber);
      const containerWidth = container.clientWidth || 320;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
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
  }, []);

  useEffect(() => {
    if (!loading && numPages > 0) renderPage(currentPage);
  }, [currentPage, loading, numPages, renderPage]);

  // Reajusta a página à largura disponível quando a janela é redimensionada.
  useEffect(() => {
    function handleResize() {
      if (!loading && numPages > 0) renderPage(currentPage);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentPage, loading, numPages, renderPage]);

  const goPrev = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setCurrentPage((p) => Math.min(numPages || p, p + 1)), [numPages]);

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
      <p role="alert" style={{ color: "#ff6b6b", fontSize: 13 }}>
        {error}
      </p>
    );
  }

  const isFirst = currentPage <= 1;
  const isLast = numPages > 0 && currentPage >= numPages;

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          border: "1px solid #22252b",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
          display: "flex",
          justifyContent: "center",
          minHeight: loading ? 220 : undefined,
        }}
      >
        {loading ? (
          <p style={{ color: "#9aa0a6", fontSize: 13, alignSelf: "center", padding: 40, margin: 0 }}>
            Carregando material...
          </p>
        ) : (
          <canvas ref={canvasRef} style={{ display: "block" }} />
        )}
      </div>

      {!loading && numPages > 0 && (
        <>
          <p style={{ textAlign: "center", fontSize: 13, color: "#9aa0a6", margin: "10px 0" }}>
            {rendering ? "Carregando página..." : `Página ${currentPage} de ${numPages}`}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              onClick={goPrev}
              disabled={isFirst}
              style={{
                padding: "12px 22px",
                borderRadius: 8,
                border: "1px solid #2a2d34",
                background: isFirst ? "transparent" : "#181a1f",
                color: isFirst ? "#5a5f68" : "#f2f2f2",
                fontSize: 14,
                fontWeight: 600,
                cursor: isFirst ? "default" : "pointer",
              }}
            >
              ← Anterior
            </button>
            <button
              onClick={goNext}
              disabled={isLast}
              style={{
                padding: "12px 22px",
                borderRadius: 8,
                border: "none",
                background: isLast ? "#2a2d34" : "#4ECDC4",
                color: isLast ? "#6a6f78" : "#0f1115",
                fontSize: 14,
                fontWeight: 600,
                cursor: isLast ? "default" : "pointer",
              }}
            >
              Próxima →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
