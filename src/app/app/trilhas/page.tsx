import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canAccessAdminHub, isFullAccessRole } from "@/lib/auth/roles";
import { getUserById } from "@/lib/repositories/usersRepository";
import { resolveActiveEnrollment } from "@/lib/services/activeEnrollmentService";
import { computeUserProgress } from "@/lib/services/userProgress";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { TrilhaPicker } from "./TrilhaPicker";

/**
 * Tela "Escolha sua trilha" — só é alcançada quando o aluno tem 2+
 * matrículas ativas e nenhuma escolhida ainda na sessão atual (ver
 * `resolveActiveEnrollment`). Com 1 matrícula só, esta tela nunca aparece
 * — `/app` resolve direto, sem fricção nenhuma para o caso comum.
 */
export default async function EscolherTrilhaPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");

  const fullAccess = isFullAccessRole(user.role);
  const active = await resolveActiveEnrollment(user.id, session.activeProgramId, user.role);
  if (active.status === "none") redirect("/app");
  if (active.status === "ok") redirect("/app");

  const options = await Promise.all(
    active.options.map(async (o) => {
      // Perfis sem travas não têm progresso (modo visualização).
      const progress = fullAccess ? null : await computeUserProgress(user.id, o.programId, o.trackId);
      return {
        programId: o.programId,
        programNome: o.programNome,
        trackNome: o.trackNome,
        percent: progress ? progress.percent : null,
      };
    })
  );

  return (
    <PageShell>
      <Header homeHref="/app" adminHref={canAccessAdminHub(user.role) ? "/admin" : undefined} />
      <Container maxWidth={560}>
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>
          {fullAccess ? "Escolha o Programa" : "Escolha sua trilha"}
        </h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          {fullAccess
            ? `Olá, ${user.nome_completo}. Você tem acesso a todos os Programas, sem travas — qual deseja ver?`
            : `Olá, ${user.nome_completo}. Você está em mais de uma trilha — qual delas você vai fazer agora?`}
        </p>
        <TrilhaPicker options={options} viewOnly={fullAccess} />
      </Container>
    </PageShell>
  );
}
