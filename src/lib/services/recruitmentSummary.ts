import { STRONG_MIN, WEAK_MAX, type Analysis } from "./recruitmentAnalysis";

/**
 * Resumo PARA O COLABORADOR (função pura): melhores possibilidades, pontos
 * fortes e o que treinar — em tom positivo e SEM números de corte (nem a nota
 * de corte de nenhuma vaga). Usa a visão "melhor tentativa". Frases por
 * regras/modelos, sem IA.
 */

export interface CandidateSummary {
  available: boolean;
  /** Quantos módulos de lógica faltam para liberar o resumo (quando indisponível). */
  modulesMissing: number;
  headline: string;
  possibilities: string[];
  strengths: string[];
  /** Vagas de interesse que ainda não são a melhor aposta + o que reforçar. */
  growth: Array<{ vacancy: string; focus: string[] }>;
  toTrain: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "Este resumo é uma orientação baseada no seu desempenho nos testes. A decisão final considera também a dinâmica e a entrevista com o gestor.";

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function buildCandidateSummary(analysis: Analysis, interestVacancyIds: string[]): CandidateSummary {
  if (!analysis.logicComplete) {
    return {
      available: false,
      modulesMissing: Math.max(0, analysis.logicModulesExpected - analysis.logicModulesDone),
      headline: "Seu resumo ainda não está pronto",
      possibilities: [],
      strengths: [],
      growth: [],
      toTrain: [],
      disclaimer: DISCLAIMER,
    };
  }

  const possibilities = analysis.ranking.map((r) => r.vacancy.nome);
  const logicStrengths = analysis.strengths.map((m) => m.module_nome);
  const areaStrengths = analysis.areas.filter((a) => (a.best ?? 0) >= STRONG_MIN).map((a) => a.area_label);
  const toTrain = analysis.weaknesses.map((m) => m.module_nome);

  const growth = analysis.fits
    .filter((f) => interestVacancyIds.includes(f.vacancy.id) && (f.best.status === "abaixo" || f.best.status === "quase"))
    .map((f) => ({ vacancy: f.vacancy.nome, focus: toTrain.slice(0, 3) }));

  const headline =
    possibilities.length > 0
      ? `Seu perfil combina com: ${list(possibilities)}`
      : "Você está construindo seu perfil — veja onde evoluir";

  return {
    available: true,
    modulesMissing: 0,
    headline,
    possibilities,
    strengths: [...logicStrengths, ...areaStrengths.map((a) => `Área ${a}`)],
    growth,
    toTrain,
    disclaimer: DISCLAIMER,
  };
}

export { WEAK_MAX };
