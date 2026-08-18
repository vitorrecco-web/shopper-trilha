/** Código padrão do Postgres para violação de UNIQUE/índice único. */
export function isUniqueViolation(err: unknown): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505"
  );
}
