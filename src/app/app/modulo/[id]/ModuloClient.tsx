"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export function ModuloClient({
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
      <div style={{ border: "1px solid #22252b", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
        <iframe
          src={`/api/modulos/${moduleId}/pdf`}
          onLoad={handlePdfLoad}
          style={{ width: "100%", height: 480, border: "none", background: "#fff" }}
          title="Material do módulo"
        />
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
