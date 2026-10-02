/**
 * Perfis de acesso — funções puras, sem I/O e sem "server-only", para
 * poderem ser usadas também no middleware (Edge) e em componentes.
 *
 * - student : aluno comum (matrícula + travas de progressão).
 * - viewer  : aluno SEM travas — vê todos os Programas/módulos liberados;
 *             nada que ele faz é gravado (modo visualização).
 * - analyst : viewer + indicadores (somente leitura).
 * - admin   : acesso a tudo (painel do gestor completo).
 */
export type Role = "admin" | "student" | "viewer" | "analyst";

/** Vê todos os Programas/módulos sem travas e sem matrícula (modo visualização). */
export function isFullAccessRole(role: Role): boolean {
  return role !== "student";
}

/** Pode abrir o hub `/admin` (admin: tudo; analyst: só o que lhe cabe). */
export function canAccessAdminHub(role: Role): boolean {
  return role === "admin" || role === "analyst";
}

export function canViewIndicadores(role: Role): boolean {
  return role === "admin" || role === "analyst";
}

/** Para onde mandar o usuário depois do login / na raiz. */
export function homePathForRole(role: Role): "/admin" | "/app" {
  return canAccessAdminHub(role) ? "/admin" : "/app";
}

export const roleLabels: Record<Role, string> = {
  student: "Aluno",
  viewer: "Aluno sem travas",
  analyst: "Sem travas + indicadores",
  admin: "Administrador (acesso a tudo)",
};
