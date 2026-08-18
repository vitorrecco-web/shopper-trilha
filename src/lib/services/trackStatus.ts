/**
 * Pura — sem I/O, sem "server-only". Pode ser importada tanto por
 * Server Components/serviços (userProgress.ts) quanto por Client
 * Components (UsersTable.tsx, UserDetail.tsx), que só precisam do
 * label/tipo para exibição.
 */
export type TrackStatus = "sem_modulos" | "nao_iniciado" | "em_andamento" | "concluida";

/**
 * §12 do PROJECT_CONTEXT: "A situação Concluída é calculada, não salva
 * como flag permanente." Deriva sempre do `percent` já calculado em
 * runtime — nunca lê nem escreve um status de trilha no banco.
 */
export function computeTrackStatus(percent: number | null): TrackStatus {
  if (percent === null) return "sem_modulos";
  if (percent === 0) return "nao_iniciado";
  if (percent === 100) return "concluida";
  return "em_andamento";
}

export const trackStatusLabel: Record<TrackStatus, string> = {
  sem_modulos: "Sem módulos",
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};
