import { getCurrentSession } from "@/lib/auth/getSession";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AppHomePage() {
  // O middleware já garante que só chega aqui quem está autenticado,
  // mas a página não confia cegamente nisso — lê a sessão de novo.
  const session = await getCurrentSession();

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Minha Trilha</h1>
        <LogoutButton />
      </div>
      <p style={{ color: "#9aa0a6", fontSize: 14 }}>
        Olá, {session?.nome} — perfil <b>{session?.role}</b>.
      </p>
      <p style={{ color: "#9aa0a6", fontSize: 14 }}>
        A trilha (fases, módulos, progresso) ainda não foi implementada —
        isso é a Fase 6 do <code>EXECUTION_PLAN.md</code>. Esta página
        confirma apenas que a autenticação e o guard de rota estão
        funcionando.
      </p>
    </main>
  );
}
