"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/ui/theme";
import { Button } from "@/components/ui/Button";
import { buttonStyle } from "@/lib/ui/buttonStyle";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * Experiência de "prova": uma questão por vez, sem ver as futuras antes
 * de responder a atual, Anterior/Próxima preservando a resposta
 * escolhida. Nenhuma mudança no backend — o GET já devolvia todas as
 * perguntas embaralhadas de uma vez (sem gabarito) e o POST já recebia
 * todas as respostas de uma vez só: aqui só paginamos localmente sobre
 * esses mesmos dados, e o POST continua disparando uma única vez, no
 * final ("Enviar prova").
 */

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

type Phase = "loading" | "error" | "in-progress" | "submitting" | "result";

export function QuizClient({ moduleId, moduleHref }: { moduleId: string; moduleHref: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [perguntas, setPerguntas] = useState<PublicPergunta[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadQuiz() {
    setPhase("loading");
    setError(null);
    setResult(null);
    setReviewing(false);
    setCurrentIndex(0);
    setAnswers({});
    try {
      const res = await fetch(`/api/modulos/${moduleId}/quiz`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível carregar a prova.");
        setPhase("error");
        return;
      }
      setPerguntas(data.perguntas);
      setPhase("in-progress");
    } catch {
      setError("Erro de conexão.");
      setPhase("error");
    }
  }

  useEffect(() => {
    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const total = perguntas.length;
  const current = perguntas[currentIndex];
  const isLast = currentIndex === total - 1;
  const hasAnswer = current ? Boolean(answers[current.id]) : false;

  function selectAnswer(alternativaId: string) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: alternativaId }));
  }

  function goPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  async function handleNextOrSubmit() {
    if (!hasAnswer) return;
    if (!isLast) {
      setCurrentIndex((i) => Math.min(total - 1, i + 1));
      return;
    }

    // Última questão respondida — envia a prova inteira de uma vez,
    // exatamente como antes (só muda quando isso acontece na UX, não a
    // chamada em si).
    setPhase("submitting");
    setError(null);
    try {
      const payload = { answers: perguntas.map((p) => ({ questionId: p.id, alternativaId: answers[p.id] ?? "" })) };
      const res = await fetch(`/api/modulos/${moduleId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as SubmitResult;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível enviar a prova.");
        setPhase("in-progress"); // mantém as respostas já dadas, permite tentar enviar de novo
        return;
      }
      setResult(data);
      setPhase("result");
    } catch {
      setError("Erro de conexão. Tente enviar novamente.");
      setPhase("in-progress");
    }
  }

  if (phase === "loading") {
    return <p style={{ color: theme.color.textMuted, fontSize: 14 }}>Carregando a prova...</p>;
  }

  if (phase === "error") {
    return (
      <div>
        <p role="alert" style={{ color: theme.color.danger, fontSize: 14, marginBottom: 16 }}>
          {error}
        </p>
        <Link href={moduleHref} style={{ color: theme.color.primaryDark, fontWeight: 600, textDecoration: "none" }}>
          ← Voltar para o módulo
        </Link>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div>
        <div
          style={{
            padding: 20,
            borderRadius: theme.radius.lg,
            background: result.passed ? theme.color.primaryLight : theme.color.dangerBg,
            border: `1px solid ${result.passed ? theme.color.primary : theme.color.danger}`,
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: result.passed ? theme.color.primaryDark : theme.color.danger,
              margin: 0,
            }}
          >
            {result.passed ? "✓ Aprovado" : "Não atingiu a nota mínima"}
          </p>
          <p style={{ fontSize: 15, color: theme.color.text, marginTop: 6, marginBottom: 0 }}>
            Nota: {result.score}% — {result.correctAnswers} de {result.totalQuestions} acertos
          </p>
          {!result.passed && (
            <p style={{ fontSize: 13, color: theme.color.textMuted, marginTop: 8, marginBottom: 0 }}>
              Você ainda não atingiu a nota mínima para aprovação neste módulo.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
          <Button variant="secondary" onClick={() => setReviewing((r) => !r)}>
            {reviewing ? "Ocultar revisão" : "Revisar respostas"}
          </Button>
          {result.passed ? (
            result.nextModuleId ? (
              <Link href={`/app/modulo/${result.nextModuleId}`} style={buttonStyle("primary")}>
                Ir para o próximo módulo: {result.nextModuleNome} →
              </Link>
            ) : (
              <span style={{ fontSize: 13, color: theme.color.textMuted }}>
                Você concluiu o último módulo disponível até agora. 🎉
              </span>
            )
          ) : (
            <Button onClick={loadQuiz}>Tentar novamente</Button>
          )}
        </div>

        {reviewing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {perguntas.map((p, i) => {
              const r = result.perQuestion.find((pq) => pq.questionId === p.id);
              const chosenTexto = p.alternativas.find((a) => a.id === answers[p.id])?.texto ?? "(não respondida)";
              return (
                <div
                  key={p.id}
                  style={{
                    padding: 14,
                    borderRadius: theme.radius.md,
                    background: r?.correct ? theme.color.primaryLight : theme.color.dangerBg,
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: theme.color.text }}>
                    {i + 1}. {p.pergunta}
                  </p>
                  <p style={{ fontSize: 13, margin: "6px 0 0", color: theme.color.text }}>
                    <span style={{ color: r?.correct ? theme.color.primaryDark : theme.color.danger, fontWeight: 700 }}>
                      {r?.correct ? "✓" : "✗"}
                    </span>{" "}
                    Sua resposta: {chosenTexto}
                  </p>
                  {r?.explicacao && (
                    <p style={{ fontSize: 12.5, color: theme.color.textMuted, margin: "6px 0 0" }}>{r.explicacao}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // in-progress ou submitting
  if (!current) return null;

  return (
    <div>
      <p style={{ fontSize: 13, color: theme.color.textMuted, fontWeight: 600, marginBottom: 8 }}>
        Questão {currentIndex + 1} de {total}
      </p>
      <ProgressBar percent={((currentIndex + 1) / total) * 100} height={6} />

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <p style={{ fontSize: 17, fontWeight: 600, color: theme.color.text, marginBottom: 16 }}>{current.pergunta}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {current.alternativas.map((a) => {
            const selected = answers[current.id] === a.id;
            return (
              <label
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: theme.radius.md,
                  border: `2px solid ${selected ? theme.color.primary : theme.color.border}`,
                  background: selected ? theme.color.primaryLight : theme.color.surface,
                  cursor: "pointer",
                  fontSize: 15,
                  minHeight: 48, // área de toque confortável em mobile
                }}
              >
                <input
                  type="radio"
                  name={current.id}
                  checked={selected}
                  onChange={() => selectAnswer(a.id)}
                  style={{ width: 18, height: 18, flexShrink: 0 }}
                />
                <span style={{ color: theme.color.text }}>{a.texto}</span>
              </label>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" style={{ color: theme.color.danger, fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <Button variant="secondary" onClick={goPrev} disabled={currentIndex === 0}>
          ← Anterior
        </Button>
        <Button onClick={handleNextOrSubmit} disabled={!hasAnswer || phase === "submitting"}>
          {phase === "submitting" ? "Enviando..." : isLast ? "Enviar prova" : "Próxima →"}
        </Button>
      </div>
    </div>
  );
}
