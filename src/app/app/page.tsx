import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canAccessAdminHub, isFullAccessRole } from "@/lib/auth/roles";
import { getUserById } from "@/lib/repositories/usersRepository";
import { resolveActiveEnrollment } from "@/lib/services/activeEnrollmentService";
import { getTrilhaViewForUser } from "@/lib/services/trilhaViewService";
import { ensureFirstModuleUnlocked } from "@/lib/services/progressionService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { TrilhaAccordion } from "./TrilhaAccordion";

export default async function AppHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");

  const adminHref = canAccessAdminHub(user.role) ? "/admin" : undefined;

  const active = await resolveActiveEnrollment(user.id, session.activeProgramId, user.role);
  if (active.status === "choose") redirect("/app/trilhas");
  if (active.status === "none") {
    return (
      <PageShell>
        <Header homeHref="/app" adminHref={adminHref} />
        <Container maxWidth={560}>
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
            {isFullAccessRole(user.role)
              ? "Nenhum Programa ativo ainda."
              : "Nenhuma trilha atribuída a você ainda. Fale com o gestor."}
          </p>
        </Container>
      </PageShell>
    );
  }

  const { programId, trackId } = active.enrollment;
  const viewOnly = active.fullAccess;

  // Fase 7: garante (de forma idempotente) que o primeiro módulo da
  // trilha deste usuário já está persistido como liberado, antes de ler
  // o estado para exibição. Perfis sem travas não gravam nada.
  if (!viewOnly) await ensureFirstModuleUnlocked(user.id, programId, trackId);

  const trilha = await getTrilhaViewForUser(user.id, programId, trackId, viewOnly);

  return (
    <PageShell>
      <Header
        homeHref="/app"
        adminHref={adminHref}
        trocarTrilhaHref={active.hasMultiple ? "/api/app/trocar-trilha" : undefined}
      />
      <Container maxWidth={560}>
        <TrilhaAccordion
          trilha={trilha}
          nome={user.nome_completo}
          viewOnly={viewOnly}
          programaNome={viewOnly ? active.enrollment.programNome : undefined}
        />
      </Container>
    </PageShell>
  );
}
