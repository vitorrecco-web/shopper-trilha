import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22 }}>Shopper Trilha</h1>
      <p style={{ color: "#9aa0a6", fontSize: 14, lineHeight: 1.5 }}>
        Fase 2 concluída: autenticação própria com sessão via cookie
        httpOnly. Minha Trilha, quiz e sincronização com o Drive ainda não
        foram implementados — ver <code>EXECUTION_PLAN.md</code>.
      </p>
      <p style={{ fontSize: 14 }}>
        <Link href="/login">Ir para o login →</Link>
      </p>
      <p style={{ color: "#9aa0a6", fontSize: 14, lineHeight: 1.5 }}>
        Verifique a conexão com o banco em{" "}
        <a href="/api/health">/api/health</a>.
      </p>
    </main>
  );
}
