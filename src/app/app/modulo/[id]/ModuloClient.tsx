"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PdfPageViewer } from "./PdfPageViewer";
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

const primaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  background: "#4ECDC4",
  color: "#0f1115",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "1px solid #2a2d34",
  background: "transparent",
  color: "#f2f2f2",
  fontSize: 14,
  cursor: "pointer",
};

function NextModuleLink({
  nextModuleId,
  nextModuleNome,
}: {
  nextModuleId: string | null;
  nextModuleNome: string | null;
}) {
  if (!nextModuleId) {
    return (
      <p style={{ fontSize: 13, color: "#9aa0a6", marginTop: 10 }}>
        Você concluiu o último módulo disponível até agora. 🎉
      </p>
    );
  }
  return (
    <Link
      href={`/app/modulo/${nextModuleId}`}
      style={{ ...primaryBtn, display: "inline-block", marginTop: 10, textDecoration: "none" }}
    >
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

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <PdfPageViewer moduleId={moduleId} onLoaded={handlePdfLoad} />
      </div>
      <a
        href={`/api/modulos/${moduleId}/pdf?download=1`}
        style={{ fontSize: 13, color: "#4ECDC4", textDecoration: "none" }}
      >
        ⭳ Baixar PDF
      </a>

      {!hasQuestions && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 10,
            background: completedNoQuiz ? "#0f1a17" : "#14161a",
            border: `1px solid ${completedNoQuiz ? "#0f3d33" : "#22252b"}`,
          }}
        >
          {completedNoQuiz ? (
            <>
              <p style={{ color: "#4ECDC4", fontWeight: 600, fontSize: 14, margin: 0 }}>✓ Módulo concluído</p>
              <NextModuleLink nextModuleId={nextModuleId} nextModuleNome={nextModuleNome} />
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#9aa0a6", margin: 0 }}>
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
      <p role="alert" style={{ color: "#ff6b6b", fontSize: 13 }}>
        O vídeo deste módulo não está disponível. Fale com o gestor.
      </p>
    );
  }

  return (
    <div>
      <YoutubePlayer videoId={videoExternalId} onProgress={handleProgress} />
      {videoTitulo && (
        <p style={{ fontSize: 13, color: "#9aa0a6", marginTop: 8, marginBottom: 0 }}>{videoTitulo}</p>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ height: 6, borderRadius: 999, background: "#22252b", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, watchedPercent)}%`,
              background: thresholdReached ? "#4ECDC4" : "#7F77DD",
              transition: "width 0.3s",
            }}
          />
        </div>
        <p style={{ fontSize: 12, color: "#9aa0a6", marginTop: 6, marginBottom: 0 }}>
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
            borderRadius: 10,
            background: completedNoQuiz ? "#0f1a17" : "#14161a",
            border: `1px solid ${completedNoQuiz ? "#0f3d33" : "#22252b"}`,
          }}
        >
          {completedNoQuiz ? (
            <>
              <p style={{ color: "#4ECDC4", fontWeight: 600, fontSize: 14, margin: 0 }}>✓ Módulo concluído</p>
              <NextModuleLink nextModuleId={nextModuleId} nextModuleNome={nextModuleNome} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#9aa0a6", margin: 0 }}>
                Assista pelo menos {VIDEO_WATCHED_THRESHOLD_PERCENT}% do vídeo para liberar a conclusão.
              </p>
              {completeError && (
                <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>
                  {completeError}
                </p>
              )}
              <button
                onClick={handleCompleteVideo}
                disabled={!thresholdReached || completing}
                style={{
                  ...primaryBtn,
                  marginTop: 10,
                  opacity: thresholdReached ? 1 : 0.5,
                  cursor: thresholdReached ? "pointer" : "default",
                }}
              >
                {completing ? "Concluindo..." : "Concluir módulo"}
              </button>
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
      <p style={{ fontSize: 13, color: "#9aa0a6", marginTop: 20 }}>
        Acesse o material acima primeiro para liberar o quiz.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Quiz</h2>

      {initialCompleted && !result && !perguntas && (
        <p style={{ fontSize: 13, color: "#4ECDC4", marginBottom: 10 }}>
          ✓ Você já foi aprovado neste módulo{initialBestScore !== null ? ` (melhor nota: ${initialBestScore}%)` : ""}
          . Tentativas continuam permitidas se quiser tentar de novo.
        </p>
      )}

      {!perguntas && !result && (
        <button onClick={loadQuiz} disabled={loadingQuiz} style={primaryBtn}>
          {loadingQuiz ? "Carregando..." : initialCompleted ? "Tentar de novo" : "Responder o quiz"}
        </button>
      )}

      {error && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 10 }}>{error}</p>}

      {perguntas && !result && (
        <div>
          {perguntas.map((p, i) => (
            <div key={p.id} style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 14, marginBottom: 6 }}>
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
                    padding: "5px 0",
                    cursor: "pointer",
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
          <button onClick={handleSubmit} disabled={submitting} style={primaryBtn}>
            {submitting ? "Enviando..." : "Enviar respostas"}
          </button>
        </div>
      )}

      {result && (
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: result.passed ? "#4ECDC4" : "#ff8a8a",
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
                  borderRadius: 8,
                  background: r.correct ? "#0f1a17" : "#1a1212",
                }}
              >
                <span style={{ color: r.correct ? "#4ECDC4" : "#ff8a8a" }}>{r.correct ? "✓" : "✗"}</span> Pergunta{" "}
                {i + 1}
                {r.explicacao && <p style={{ margin: "4px 0 0", color: "#9aa0a6" }}>{r.explicacao}</p>}
              </div>
            ))}
          </div>

          {result.passed ? (
            <NextModuleLink nextModuleId={result.nextModuleId} nextModuleNome={result.nextModuleNome} />
          ) : (
            <button onClick={loadQuiz} style={{ ...secondaryBtn, marginTop: 12 }}>
              Tentar de novo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
