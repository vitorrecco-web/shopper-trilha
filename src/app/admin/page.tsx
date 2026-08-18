import { getCurrentSession } from "@/lib/auth/getSession";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AdminHomePage() {
  // O middleware já barra quem não é admin, mas a página confirma de novo
  // (defesa em profundidade — nunca confiar só no middleware).
  const session = await getCurrentSession();

  return (
    <main style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Painel do Gestor</h1>
        <LogoutButton />
      </div>
      <p style={{ color: "#9aa0a6", fontSize: 14 }}>
        Olá, {session?.nome} — acesso administrativo confirmado.
      </p>
      <p style={{ color: "#9aa0a6", fontSize: 14 }}>
        CRUD de usuários e sincronização com o Drive ainda não foram
        implementados — isso é a Fase 3 e a Fase 5 do{" "}
        <code>EXECUTION_PLAN.md</code>. Esta página confirma apenas que o
        guard de rota restrito a <b>admin</b> está funcionando.
      </p>
    </main>
  );
}
