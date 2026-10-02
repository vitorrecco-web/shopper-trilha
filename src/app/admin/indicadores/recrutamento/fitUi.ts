export type FitStatus = "atinge" | "quase" | "abaixo" | "aguardando";

export const fitLabel: Record<FitStatus, string> = {
  atinge: "Atinge",
  quase: "Quase",
  abaixo: "Abaixo",
  aguardando: "Aguardando",
};

export const fitTone: Record<FitStatus, "primary" | "warning" | "danger" | "neutral"> = {
  atinge: "primary",
  quase: "warning",
  abaixo: "danger",
  aguardando: "neutral",
};

export function fmtScore(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${String(n).replace(".", ",")}`;
}
