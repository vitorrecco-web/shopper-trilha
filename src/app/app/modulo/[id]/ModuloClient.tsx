"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { buttonStyle } from "@/lib/ui/buttonStyle";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FocusOverlay, ExpandButton } from "@/components/ui/FocusOverlay";
import { PdfPageViewer, type PdfPageViewerHandle } from "./PdfPageViewer";
import { YoutubePlayer } from "./YoutubePlayer";

interface PublicAlternativa {
  id: string;
  texto: string;
}
interface PublicPergunta {
  id: string;
  pergunta: string;
  alternativas: PublicAlternativa[];
}
interface PerQuestionResult {
  questionId: string;
  correct: boolean;
  explicacao: string | null;
}
interface SubmitResult {
  ok: boolean;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  perQuestion: PerQuestionResult[];
  nextModuleId: string | null;
  nextModuleNome: string | null;
  error?: string;
}

function NextModuleLink({
  nextModuleId,
  nextModuleNome,
}: {
  nextModuleId: string | null;
  nextModuleNome: string | null;
}) {
  if (!nextModuleId) {
    return (
      <p style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 10 }}>
        Você concluiu o último módulo disponível até agora. 🎉
      </p>
    );
  }
  return (
    <Link href={`/app/modulo/${nextModuleId}`} style={{ ...buttonStyle("primary"), marginTop: 10 }}>
      Ir para o próximo módulo: {nextModuleNome} →
    </Link>
  );
}

// Precisa bater com VIDEO_WATCHED_THRESHOLD_PERCENT em
// src/lib/services/moduleAccessService.ts (a validação real é sempre
// no servidor — este valor aqui só controla quando habilitar os
// botões/liberar a UI do quiz, evitando um clique que o servidor
// recusaria de qualquer forma).
const VIDEO_WATCHED_THRESHOLD_PERCENT = 90;

export function ModuloClient({
  moduleId,
  materialType,
  hasQuestions,
  videoExternalId,
  videoTitulo,
  initialMaterialAccessed,
  initialVideoWatchedPercent,
  initialCompleted,
  initialBestScore,
  nextModuleId,
  nextModuleNome,
}: {
  moduleId: string;
  materialType: "pdf" | "youtube";
  hasQuestions: boolean;
  videoExternalId: string | null;
  videoTitulo: string | null;
  initialMaterialAccessed: boolean;
  initialVideoWatchedPercent: number | null;
  initialCompleted: boolean;
  initialBestScore: number | null;
  nextModuleId: string | null;
  nextModuleNome: string | null;
}) {
  if (materialType === "youtube") {
    return (
      <VideoMaterialSection
        moduleId={moduleId}
        videoExternalId={videoExternalId}
        videoTitulo={videoTitulo}
        hasQuestions={hasQuestions}
        initialAccessed={initialMaterialAccessed}
        initialWatchedPercent={initialVideoWatchedPercent}
        initialCompleted={initialCompleted}
        initialBestScore={initialBestScore}
        nextModuleId={nextModuleId}
        nextModuleNome={nextModuleNome}
      />
    );
  }

  return (
    <PdfMaterialSection
      moduleId={moduleId}
      hasQuestions={hasQuestions}
      initialMaterialAccessed={initialMaterialAccessed}
      initialCompleted={initialCompleted}
      initialBestScore={initialBestScore}
      nextModuleId={nextModuleId}
      nextModuleNome={nextModuleNome}
    />
  );
}

function PdfMaterialSection({
  moduleId,
  hasQuestions,
  initialMaterialAccessed,
  initialCompleted,
  initialBestScore,
  nextModuleId,
  nextModuleNome,
}: {
  moduleId: string;
  hasQuestions: boolean;
  initialMaterialAccessed: boolean;
  initialCompleted: boolean;
  initialBestScore: number | null;
  nextModuleId: string | null;
  nextModuleNome: string | null;
}) {
  const router = useRouter();
  const [accessed, setAccessed] = useState(initialMaterialAccessed);
  const [completedNoQuiz, setCompletedNoQuiz] = useState(initialCompleted && !hasQuestions);
  const refreshedRef = useRef(false);

  const pdfRef = useRef<PdfPageViewerHandle>(null);
  const [expanded, setExpanded] = useState(false);
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 0 });
  const touchStartXRef = useRef<number | null>(null);

  // BUG CORRIGIDO: esta função precisa ter identidade estável entre
  // renders. Antes ela era criada inline (`(c,t) => setPageInfo(...)`)
  // diretamente no JSX — uma função NOVA a cada render. Como o
  // `useEffect` dentro de PdfPageViewer depende de `onPageChange`, ele
  // disparava de novo a cada vez que a identidade mudava, chamando
  // `setPageInfo` com um objeto novo, o que re-renderizava este
  // componente, criando outra função nova — um loop infinito de
  // re-render que travava a aba inteira (por isso os cliques no
  // breadcrumb/botão de voltar paravam de responder só nesta página, e
  // o PDF parecia nunca terminar de carregar). `useCallback` com deps
  // vazias resolve a causa; a checagem de "mudou de verdade" dentro é
  // uma segunda camada de proteção, para nunca mais depender só de
  // identidade de função ficar estável.
  const handlePageChange = useCallback((current: number, total: number) => {
    setPageInfo((prev) => (prev.current === current && prev.total === total ? prev : { current, total }));
  }, []);

  // §9: o próprio carregamento do visualizador (a requisição real ao
  // endpoint do PDF) é o "primeiro acesso" — o servidor já grava
  // material_accessed nesse momento. Aqui só refletimos na tela.
  function handlePdfLoad() {
    setAccessed(true);
    if (!hasQuestions && !refreshedRef.current) {
      refreshedRef.current = true;
      setCompletedNoQuiz(true);
      // Fase 6 recalcula a trilha a partir do banco — não precisa de
      // outro endpoint só para "avisar" que completou.
      router.refresh();
    }
  }

  // O container do PdfPageViewer muda de tamanho ao expandir/recolher,
  // mas isso não dispara o 'resize' da janela — força um novo render da
  // página atual no tamanho novo depois que o layout assenta.
  useEffect(() => {
    const raf = requestAnimationFrame(() => pdfRef.current?.refit());
    return () => cancelAnimationFrame(raf);
  }, [expanded]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < 40) return; // gesto pequeno demais — provavelmente não é intencional
    if (delta < 0) pdfRef.current?.goNext();
    else pdfRef.current?.goPrev();
  }

  const isFirst = pageInfo.current <= 1;
  const isLast = pageInfo.total > 0 && pageInfo.current >= pageInfo.total;

  const arrowBaseStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    border: "none",
    background: "rgba(20, 22, 20, 0.35)",
    color: "#fff",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <FocusOverlay
          expanded={expanded}
          onRequestClose={() => setExpanded(false)}
          ariaLabel="Material do módulo em tela ampliada"
          footer={pageInfo.total > 0 ? `Página ${pageInfo.current} de ${pageInfo.total}` : null}
          overlayControls={
            <>
              <button
                onClick={() => pdfRef.current?.goPrev()}
                disabled={isFirst}
                aria-label="Página anterior"
                style={{ ...arrowBaseStyle, left: 8, opacity: isFirst ? 0 : 1, pointerEvents: isFirst ? "none" : "auto" }}
              >
                ‹
              </button>
              <button
                onClick={() => pdfRef.current?.goNext()}
                disabled={isLast}
                aria-label="Próxima página"
                style={{ ...arrowBaseStyle, right: 8, opacity: isLast ? 0 : 1, pointerEvents: isLast ? "none" : "auto" }}
              >
                ›
              </button>
            </>
          }
        >
          <div
            style={{ position: "relative", width: "100%", height: expanded ? "100%" : "auto" }}
            onTouchStart={expanded ? handleTouchStart : undefined}
            onTouchEnd={expanded ? handleTouchEnd : undefined}
          >
            <PdfPageViewer
              ref={pdfRef}
              moduleId={moduleId}
              onLoaded={handlePdfLoad}
              onPageChange={handlePageChange}
              hideControls={expanded}
              fitAvailableHeight={expanded}
            />
            {!expanded && <ExpandButton onClick={() => setExpanded(true)} />}
          </div>
        </FocusOverlay>
      </div>
      <a
        href={`/api/modulos/${moduleId}/pdf?download=1`}
        style={{ fontSize: 13, color: theme.color.primaryDark, textDecoration: "none", fontWeight: 600 }}
      >
        ⭳ Baixar PDF
      </a>

      {!hasQuestions && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: theme.radius.lg,
            background: completedNoQuiz ? theme.color.primaryLight : theme.color.bg,
            border: `1px solid ${completedNoQuiz ? theme.color.primary : theme.color.border}`,
          }}
        >
          {completedNoQuiz ? (
            <>
              <p style={{ color: theme.color.primaryDark, fontWeight: 600, fontSize: 14, margin: 0 }}>
                ✓ Módulo concluído
              </p>
              <NextModuleLink nextModuleId={nextModuleId} nextModuleNome={nextModuleNome} />
            </>
          ) : (
            <p style={{ fontSize: 13, color: theme.color.textMuted, margin: 0 }}>
              Este módulo não tem quiz — ele é concluído automaticamente ao acessar o material acima.
            </p>
          )}
        </div>
      )}

      {hasQuestions && (
        <QuizSection
          moduleId={moduleId}
          accessed={accessed}
          initialCompleted={initialCompleted}
          initialBestScore={initialBestScore}
        />
      )}
    </div>
  );
}

function VideoMaterialSection({
  moduleId,
  videoExternalId,
  videoTitulo,
  hasQuestions,
  initialAccessed,
  initialWatchedPercent,
  initialCompleted,
  initialBestScore,
  nextModuleId,
  nextModuleNome,
}: {
  moduleId: string;
  videoExternalId: string | null;
  videoTitulo: string | null;
  hasQuestions: boolean;
  initialAccessed: boolean;
  initialWatchedPercent: number | null;
  initialCompleted: boolean;
  initialBestScore: number | null;
  nextModuleId: string | null;
  nextModuleNome: string | null;
}) {
  const [accessed, setAccessed] = useState(initialAccessed);
  const [watchedPercent, setWatchedPercent] = useState(initialWatchedPercent ?? 0);
  const [completedNoQuiz, setCompletedNoQuiz] = useState(initialCompleted && !hasQuestions);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const reportingRef = useRef(false);

  const thresholdReached = watchedPercent >= VIDEO_WATCHED_THRESHOLD_PERCENT;

  const handleProgress = useCallback(
    async (percent: number) => {
      // Evita empilhar requisições se uma anterior ainda não voltou
      // (o player reporta a cada ~3s enquanto toca).
      if (reportingRef.current) return;
      reportingRef.current = true;
      try {
        const res = await fetch(`/api/modulos/${moduleId}/video-progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ percent }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setWatchedPercent(data.videoWatchedPercent);
          setAccessed(true);
        }
      } catch {
        // silencioso — o próximo tick de progresso tenta de novo
      } finally {
        reportingRef.current = false;
      }
    },
    [moduleId]
  );

  async function handleCompleteVideo() {
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/modulos/${moduleId}/complete-video`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCompleteError(data.error ?? "Não foi possível concluir o módulo.");
        return;
      }
      setCompletedNoQuiz(true);
    } catch {
      setCompleteError("Erro de conexão.");
    } finally {
      setCompleting(false);
    }
  }

  if (!videoExternalId) {
    return (
      <p role="alert" style={{ color: theme.color.danger, fontSize: 13 }}>
        O vídeo deste módulo não está disponível. Fale com o gestor.
      </p>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <FocusOverlay
          expanded={expanded}
          onRequestClose={() => setExpanded(false)}
          ariaLabel="Vídeo do módulo em tela ampliada"
        >
          <div style={{ position: "relative", width: "100%", height: expanded ? "100%" : "auto" }}>
            <div style={expanded ? { height: "100%", display: "flex", alignItems: "center" } : undefined}>
              <YoutubePlayer videoId={videoExternalId} onProgress={handleProgress} />
            </div>
            {!expanded && <ExpandButton onClick={() => setExpanded(true)} />}
          </div>
        </FocusOverlay>
      </div>
      {videoTitulo && (
        <p style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 8, marginBottom: 0 }}>{videoTitulo}</p>
      )}

      <div style={{ marginTop: 12 }}>
        <ProgressBar percent={watchedPercent} tone={thresholdReached ? "primary" : "warning"} height={6} />
        <p style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 6, marginBottom: 0 }}>
          {thresholdReached
            ? "Percentual mínimo assistido ✓"
            : `Assistido: ${Math.round(watchedPercent)}% (mínimo para continuar: ${VIDEO_WATCHED_THRESHOLD_PERCENT}%)`}
        </p>
      </div>

      {!hasQuestions && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: theme.radius.lg,
            background: completedNoQuiz ? theme.color.primaryLight : theme.color.bg,
            border: `1px solid ${completedNoQuiz ? theme.color.primary : theme.color.border}`,
          }}
        >
          {completedNoQuiz ? (
            <>
              <p style={{ color: theme.color.primaryDark, fontWeight: 600, fontSize: 14, margin: 0 }}>
                ✓ Módulo concluído
              </p>
              <NextModuleLink nextModuleId={nextModuleId} nextModuleNome={nextModuleNome} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: theme.color.textMuted, margin: 0 }}>
                Assista pelo menos {VIDEO_WATCHED_THRESHOLD_PERCENT}% do vídeo para liberar a conclusão.
              </p>
              {completeError && (
                <p role="alert" style={{ color: theme.color.danger, fontSize: 13, marginTop: 8 }}>
                  {completeError}
                </p>
              )}
              <Button onClick={handleCompleteVideo} disabled={!thresholdReached || completing} style={{ marginTop: 10 }}>
                {completing ? "Concluindo..." : "Concluir módulo"}
              </Button>
            </>
          )}
        </div>
      )}

      {hasQuestions && (
        <QuizSection
          moduleId={moduleId}
          accessed={accessed && thresholdReached}
          initialCompleted={initialCompleted}
          initialBestScore={initialBestScore}
        />
      )}
    </div>
  );
}

function QuizSection({
  moduleId,
  accessed,
  initialCompleted,
  initialBestScore,
}: {
  moduleId: string;
  accessed: boolean;
  initialCompleted: boolean;
  initialBestScore: number | null;
}) {
  const [perguntas, setPerguntas] = useState<PublicPergunta[] | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQuiz() {
    setLoadingQuiz(true);
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      const res = await fetch(`/api/modulos/${moduleId}/quiz`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível carregar o quiz.");
        return;
      }
      setPerguntas(data.perguntas);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoadingQuiz(false);
    }
  }

  async function handleSubmit() {
    if (!perguntas) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: perguntas.map((p) => ({ questionId: p.id, alternativaId: answers[p.id] ?? "" })),
      };
      const res = await fetch(`/api/modulos/${moduleId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as SubmitResult;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível enviar as respostas.");
        return;
      }
      setResult(data);
      setPerguntas(null);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!accessed) {
    return (
      <p style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 20 }}>
        Acesse o material acima primeiro para liberar o quiz.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 15, marginBottom: 8, color: theme.color.text }}>Quiz</h2>

      {initialCompleted && !result && !perguntas && (
        <p style={{ fontSize: 13, color: theme.color.primaryDark, marginBottom: 10 }}>
          ✓ Você já foi aprovado neste módulo{initialBestScore !== null ? ` (melhor nota: ${initialBestScore}%)` : ""}
          . Tentativas continuam permitidas se quiser tentar de novo.
        </p>
      )}

      {!perguntas && !result && (
        <Button onClick={loadQuiz} disabled={loadingQuiz}>
          {loadingQuiz ? "Carregando..." : initialCompleted ? "Tentar de novo" : "Responder o quiz"}
        </Button>
      )}

      {error && <p style={{ color: theme.color.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}

      {perguntas && !result && (
        <div>
          {perguntas.map((p, i) => (
            <div key={p.id} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 14, marginBottom: 6, color: theme.color.text }}>
                {i + 1}. {p.pergunta}
              </p>
              {p.alternativas.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    fontSize: 13,
                    color: theme.color.text,
                    padding: "6px 0",
                    cursor: "pointer",
                    minHeight: 32, // área de toque confortável em mobile
                  }}
                >
                  <input
                    type="radio"
                    name={p.id}
                    value={a.id}
                    checked={answers[p.id] === a.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [p.id]: a.id }))}
                  />
                  {a.texto}
                </label>
              ))}
            </div>
          ))}
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar respostas"}
          </Button>
        </div>
      )}

      {result && (
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: result.passed ? theme.color.primaryDark : theme.color.danger,
              marginBottom: 10,
            }}
          >
            {result.passed ? "✓ Aprovado" : "Não atingiu a nota mínima (70%)"} — {result.score}% (
            {result.correctAnswers}/{result.totalQuestions})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.perQuestion.map((r, i) => (
              <div
                key={r.questionId}
                style={{
                  fontSize: 13,
                  padding: "8px 10px",
                  borderRadius: theme.radius.md,
                  background: r.correct ? theme.color.primaryLight : theme.color.dangerBg,
                }}
              >
                <span style={{ color: r.correct ? theme.color.primaryDark : theme.color.danger, fontWeight: 700 }}>
                  {r.correct ? "✓" : "✗"}
                </span>{" "}
                <span style={{ color: theme.color.text }}>Pergunta {i + 1}</span>
                {r.explicacao && <p style={{ margin: "4px 0 0", color: theme.color.textMuted }}>{r.explicacao}</p>}
              </div>
            ))}
          </div>

          {result.passed ? (
            <NextModuleLink nextModuleId={result.nextModuleId} nextModuleNome={result.nextModuleNome} />
          ) : (
            <Button variant="secondary" onClick={loadQuiz} style={{ marginTop: 12 }}>
              Tentar de novo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
