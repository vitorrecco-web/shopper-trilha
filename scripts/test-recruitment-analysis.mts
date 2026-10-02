/**
 * Teste da regra de cálculo do Recrutamento (função pura, sem banco).
 * Uso: npx tsx scripts/test-recruitment-analysis.mts
 */
import { buildCandidateSummary } from "../src/lib/services/recruitmentSummary";
import { analyzeCandidate, interestAlerts, type AnalysisResult, type AnalysisVacancy } from "../src/lib/services/recruitmentAnalysis";

let failures = 0;
function check(cond: boolean, msg: string) {
  console.log(cond ? "  OK   " : "  FALHA", msg);
  if (!cond) failures++;
}

const vagas: AnalysisVacancy[] = [
  { id: "tec", nome: "TEC", logic_cutoff: 80, area_key: null, area_cutoff: null },
  { id: "rc", nome: "RC", logic_cutoff: 50, area_key: "rc", area_cutoff: null },
  { id: "log", nome: "Logística", logic_cutoff: 60, area_key: "logistica", area_cutoff: 70 },
];

let seq = 0;
const r = (area: string, mod: string, score: number, total: number): AnalysisResult => ({
  area_key: area,
  area_label: area === "logica" ? "Teste de lógica" : area.toUpperCase(),
  module_id: `${area}-${mod}`,
  module_nome: `Módulo ${mod}`,
  score,
  total_questions: total,
  submitted_at: `2026-10-01T10:00:${String(seq++).padStart(2, "0")}Z`,
});

// --- Exemplo do gestor: média ~65 na lógica => não atinge TEC (80) e atinge RC (50)
console.log("1) Candidato com ~65 na lógica");
const a1 = analyzeCandidate(
  [r("logica", "1", 70, 4), r("logica", "2", 50, 2), r("logica", "3", 60, 2), r("logica", "4", 70, 4)],
  vagas,
  4
);
check(a1.logic?.best === 65, `nota de lógica (melhor) = 65 (veio ${a1.logic?.best})`);
const tec = a1.fits.find((f) => f.vacancy.id === "tec")!;
const rc = a1.fits.find((f) => f.vacancy.id === "rc")!;
check(tec.best.status === "abaixo" && tec.best.logicGap === 15, "TEC (80): abaixo, faltam 15");
// RC não tem corte de área (area_cutoff null) => não depende de ter nota na área
check(rc.best.status === "atinge", "RC (50) sem corte de área: atinge");
const logv = a1.fits.find((f) => f.vacancy.id === "log")!;
check(logv.best.status === "aguardando", "Logística (corte de área 70) sem resultados na área: aguardando");

// --- Melhor tentativa x média
console.log("2) Melhor tentativa x média de todas");
const a2 = analyzeCandidate(
  [r("logica", "1", 25, 4), r("logica", "1", 100, 4), r("logica", "2", 50, 4)],
  vagas,
  2
);
// módulo 1: tentativas 25 e 100 => melhor 100, média 62,5 ; módulo 2: 50
check(a2.logic?.best === 75, `melhor tentativa: (100*4 + 50*4)/8 = 75 (veio ${a2.logic?.best})`);
check(a2.logic?.avg === 56.3 || a2.logic?.avg === 56.2, `média de todas: (62,5*4 + 50*4)/8 ≈ 56,3 (veio ${a2.logic?.avg})`);

// --- Quase (<= 10 pts)
console.log("3) Quase atinge");
const a3 = analyzeCandidate([r("logica", "1", 72, 4)], vagas, 1);
check(a3.fits.find((f) => f.vacancy.id === "tec")!.best.status === "quase", "72 vs TEC 80: quase (faltam 8)");

// --- Ponderação por nº de questões
console.log("4) Ponderação por questões");
const a4 = analyzeCandidate([r("logica", "1", 100, 2), r("logica", "2", 0, 8)], vagas, 2);
check(a4.logic?.best === 20, `(100*2 + 0*8)/10 = 20 (veio ${a4.logic?.best})`);

// --- Incompleto => aguardando
console.log("5) Teste de lógica incompleto");
const a5 = analyzeCandidate([r("logica", "1", 100, 4)], vagas, 7);
check(!a5.logicComplete && a5.logicModulesDone === 1 && a5.logicModulesExpected === 7, "1 de 7 módulos: incompleto");
check(a5.fits.every((f) => f.best.status === "aguardando"), "sem recomendação definitiva enquanto incompleto");

// --- Afinidade por área + ranking
console.log("6) Ranking por afinidade");
const a6 = analyzeCandidate(
  [r("logica", "1", 90, 4), r("rc", "1", 60, 4), r("logistica", "1", 95, 4)],
  vagas,
  1
);
check(a6.ranking[0]?.vacancy.id === "log", "melhor possibilidade = Logística (área 95)");
check(a6.ranking.map((f) => f.vacancy.id).join(",") === "log,rc,tec", `ranking: log, rc, tec (veio ${a6.ranking.map((f) => f.vacancy.id)})`);

// --- Interesse x aptidão
console.log("7) Alerta interesse x aptidão");
const alerts = interestAlerts(a1, ["tec", "rc"]);
check(alerts.length === 1 && alerts[0].vacancy.id === "tec", "quer TEC mas está abaixo: alerta só para TEC");

// --- Estrutura mudou: módulo antigo continua contando pela área
console.log("8) Mudança de estrutura (mesma área, módulo diferente)");
const a8 = analyzeCandidate(
  [r("rc", "1", 80, 4), { ...r("rc", "novo", 60, 4), module_nome: "Módulo RC novo" }, r("logica", "1", 85, 4)],
  vagas,
  1
);
check(a8.areas.find((a) => a.area_key === "rc")?.modules.length === 2, "área RC agrega módulo antigo e novo");

// --- Resumo do colaborador
console.log("9) Resumo do colaborador (sem números de corte)");
const full = analyzeCandidate(
  [r("logica", "1", 90, 4), r("logica", "2", 40, 4), r("rc", "1", 85, 4)],
  vagas,
  2
);
const sum = buildCandidateSummary(full, ["tec"]);
const text = JSON.stringify(sum);
check(sum.available && sum.possibilities.includes("RC"), "disponível e recomenda RC (atinge 50)");
check(!text.includes("80") && !text.includes("cutoff") && !text.includes("corte"), "não expõe nota de corte nem 'corte' no texto");
check(sum.toTrain.includes("Módulo 2") && sum.growth.some((g) => g.vacancy === "TEC"), "sugere treinar o módulo fraco e liga ao interesse (TEC)");
const pending = buildCandidateSummary(analyzeCandidate([r("logica", "1", 90, 4)], vagas, 3), []);
check(!pending.available && pending.modulesMissing === 2, "indisponível enquanto o teste não termina (faltam 2)");

console.log(failures === 0 ? "\nTUDO OK" : `\n${failures} FALHA(S)`);
process.exit(failures === 0 ? 0 : 1);
