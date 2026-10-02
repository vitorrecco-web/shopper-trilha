/**
 * Recrutamento Interno — regras de cálculo (função pura, sem I/O).
 *
 * Entrada = resultados por tentativa JÁ gravados com a ÁREA e os nomes da
 * época (`recruitment_results`) + as vagas atuais. Agrupa por `area_key`,
 * nunca por fase/módulo atuais — assim trocar os módulos de uma área não
 * invalida o histórico.
 *
 * Duas visões, sempre calculadas em separado:
 *  - "best": melhor tentativa de cada módulo;
 *  - "avg" : média de TODAS as tentativas de cada módulo.
 * Nota da área = % de acertos ponderado pelo nº de questões de cada módulo
 * (equivale ao % nas questões da área). Sem `Date.now()`/aleatório: mesma
 * entrada, mesma saída.
 */

export const LOGIC_AREA = "logica";
/** "Quase atinge": até esta quantidade de pontos abaixo do corte. */
export const NEAR_MARGIN = 10;
export const STRONG_MIN = 80;
export const WEAK_MAX = 60;

export interface AnalysisResult {
  area_key: string;
  area_label: string;
  module_id: string;
  module_nome: string;
  score: number; // 0-100 daquela tentativa
  total_questions: number;
  submitted_at: string;
}

export interface AnalysisVacancy {
  id: string;
  nome: string;
  logic_cutoff: number;
  area_key: string | null;
  area_cutoff: number | null;
}

export interface ModuleStat {
  module_id: string;
  module_nome: string;
  attempts: number;
  best: number;
  avg: number;
  totalQuestions: number;
}

export interface AreaStat {
  area_key: string;
  area_label: string;
  modules: ModuleStat[];
  /** Nota da área (0-100) em cada visão; null se não há nenhuma tentativa. */
  best: number | null;
  avg: number | null;
  attempts: number;
}

export type FitStatus = "atinge" | "quase" | "abaixo" | "aguardando";
export type View = "best" | "avg";

export interface FitDetail {
  status: FitStatus;
  logicScore: number | null;
  /** Pontos que faltam no corte de lógica (só quando abaixo). */
  logicGap: number | null;
  areaScore: number | null;
  areaGap: number | null;
}

export interface VacancyFit {
  vacancy: AnalysisVacancy;
  best: FitDetail;
  avg: FitDetail;
}

export interface Analysis {
  logic: AreaStat | null;
  areas: AreaStat[]; // áreas que não são lógica
  /** Teste de lógica completo = todos os módulos conhecidos da lógica têm tentativa (ver `expectedLogicModules`). */
  logicModulesDone: number;
  logicModulesExpected: number;
  logicComplete: boolean;
  fits: VacancyFit[];
  /** Vagas que "atingem" (visão melhor tentativa), da melhor para a pior afinidade. */
  ranking: VacancyFit[];
  strengths: ModuleStat[];
  weaknesses: ModuleStat[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Estatística de UMA área a partir dos resultados dela (já filtrados por área). */
function buildAreaStat(area_key: string, area_label: string, results: AnalysisResult[]): AreaStat {
  const byModule = new Map<string, AnalysisResult[]>();
  for (const r of results) {
    const list = byModule.get(r.module_id) ?? [];
    list.push(r);
    byModule.set(r.module_id, list);
  }

  const modules: ModuleStat[] = [];
  for (const [module_id, list] of byModule) {
    const sorted = [...list].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
    const latest = sorted[sorted.length - 1];
    modules.push({
      module_id,
      module_nome: latest.module_nome,
      attempts: list.length,
      best: Math.max(...list.map((r) => r.score)),
      avg: list.reduce((sum, r) => sum + r.score, 0) / list.length,
      totalQuestions: latest.total_questions,
    });
  }
  modules.sort((a, b) => a.module_nome.localeCompare(b.module_nome, "pt-BR", { numeric: true }));

  const weight = (m: ModuleStat) => (m.totalQuestions > 0 ? m.totalQuestions : 1);
  const totalWeight = modules.reduce((sum, m) => sum + weight(m), 0);
  const weighted = (pick: (m: ModuleStat) => number) =>
    totalWeight === 0 ? null : round1(modules.reduce((sum, m) => sum + pick(m) * weight(m), 0) / totalWeight);

  return {
    area_key,
    area_label,
    modules,
    best: weighted((m) => m.best),
    avg: weighted((m) => m.avg),
    attempts: results.length,
  };
}

function fitFor(
  vacancy: AnalysisVacancy,
  logicScore: number | null,
  areaScore: number | null,
  logicComplete: boolean
): FitDetail {
  const waitingArea = vacancy.area_key !== null && vacancy.area_cutoff !== null && areaScore === null;
  if (logicScore === null || !logicComplete || waitingArea) {
    return { status: "aguardando", logicScore, logicGap: null, areaScore, areaGap: null };
  }

  const logicGap = Math.max(0, round1(vacancy.logic_cutoff - logicScore));
  const needsArea = vacancy.area_key !== null && vacancy.area_cutoff !== null;
  const areaGap = needsArea && areaScore !== null ? Math.max(0, round1((vacancy.area_cutoff as number) - areaScore)) : 0;

  const worstGap = Math.max(logicGap, areaGap);
  const status: FitStatus = worstGap === 0 ? "atinge" : worstGap <= NEAR_MARGIN ? "quase" : "abaixo";
  return { status, logicScore, logicGap, areaScore, areaGap: needsArea ? areaGap : null };
}

/**
 * @param expectedLogicModules nº de módulos do teste de lógica hoje (para saber se está completo);
 *   quando não informado, usa os módulos que já têm tentativa.
 */
export function analyzeCandidate(
  results: AnalysisResult[],
  vacancies: AnalysisVacancy[],
  expectedLogicModules?: number
): Analysis {
  const byArea = new Map<string, AnalysisResult[]>();
  for (const r of results) {
    const list = byArea.get(r.area_key) ?? [];
    list.push(r);
    byArea.set(r.area_key, list);
  }

  const labelOf = (key: string) => byArea.get(key)?.[byArea.get(key)!.length - 1]?.area_label ?? key;
  const stats = new Map<string, AreaStat>();
  for (const [key, list] of byArea) stats.set(key, buildAreaStat(key, labelOf(key), list));

  const logic = stats.get(LOGIC_AREA) ?? null;
  const areas = [...stats.values()].filter((a) => a.area_key !== LOGIC_AREA).sort((a, b) => a.area_label.localeCompare(b.area_label, "pt-BR"));

  const logicModulesDone = logic?.modules.length ?? 0;
  const logicModulesExpected = Math.max(expectedLogicModules ?? logicModulesDone, logicModulesDone);
  const logicComplete = logicModulesExpected > 0 && logicModulesDone >= logicModulesExpected;

  const fits: VacancyFit[] = vacancies.map((vacancy) => {
    const area = vacancy.area_key ? stats.get(vacancy.area_key) : undefined;
    return {
      vacancy,
      best: fitFor(vacancy, logic?.best ?? null, area?.best ?? null, logicComplete),
      avg: fitFor(vacancy, logic?.avg ?? null, area?.avg ?? null, logicComplete),
    };
  });

  // Melhor possibilidade: vagas que atingem (melhor tentativa), pela afinidade (nota da área) e depois pela folga no corte de lógica.
  const ranking = fits
    .filter((f) => f.best.status === "atinge")
    .sort((a, b) => {
      const aa = a.best.areaScore ?? -1;
      const bb = b.best.areaScore ?? -1;
      if (aa !== bb) return bb - aa;
      const aSlack = (a.best.logicScore ?? 0) - a.vacancy.logic_cutoff;
      const bSlack = (b.best.logicScore ?? 0) - b.vacancy.logic_cutoff;
      return bSlack - aSlack;
    });

  const logicModules = logic?.modules ?? [];
  const strengths = logicModules.filter((m) => m.best >= STRONG_MIN).sort((a, b) => b.best - a.best).slice(0, 3);
  const weaknesses = logicModules.filter((m) => m.best < WEAK_MAX).sort((a, b) => a.best - b.best).slice(0, 3);

  return { logic, areas, logicModulesDone, logicModulesExpected, logicComplete, fits, ranking, strengths, weaknesses };
}

/** Interesse × aptidão: vagas de interesse em que o candidato NÃO atinge (visão melhor tentativa). */
export function interestAlerts(analysis: Analysis, interestVacancyIds: string[]): VacancyFit[] {
  return analysis.fits.filter(
    (f) => interestVacancyIds.includes(f.vacancy.id) && (f.best.status === "abaixo" || f.best.status === "quase")
  );
}
