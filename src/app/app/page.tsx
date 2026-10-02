import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
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

  const active = await resolveActiveEnrollment(user.id, session.activeProgramId);
  if (active.status === "choose") redirect("/app/trilhas");
  if (active.status === "none") {
    return (
      <PageShell>
        <Header homeHref="/app" />
        <Container maxWidth={560}>
          <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
            Nenhuma trilha atribuída a você ainda. Fale com o gestor.
          </p>
        </Container>
      </PageShell>
    );
  }

  const { programId, trackId } = active.enrollment;

  // Fase 7: garante (de forma idempotente) que o primeiro módulo da
  // trilha deste usuário já está persistido como liberado, antes de ler
  // o estado para exibição.
  await ensureFirstModuleUnlocked(user.id, programId, trackId);

  const trilha = await getTrilhaViewForUser(user.id, programId, trackId);

  return (
    <PageShell>
      <Header homeHref="/app" trocarTrilhaHref={active.hasMultiple ? "/app/trilhas" : undefined} />
      <Container maxWidth={560}>
        <TrilhaAccordion trilha={trilha} nome={user.nome_completo} />
      </Container>
    </PageShell>
  );
}
