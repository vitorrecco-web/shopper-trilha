import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { getTrilhaViewForUser } from "@/lib/services/trilhaViewService";
import { ensureFirstModuleUnlocked } from "@/lib/services/progressionService";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { TrilhaAccordion } from "./TrilhaAccordion";

export default async function AppHomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");

  // Fase 7: garante (de forma idempotente) que o primeiro módulo da
  // trilha deste usuário já está persistido como liberado, antes de ler
  // o estado para exibição.
  await ensureFirstModuleUnlocked(user.id, user.track_id);

  const trilha = await getTrilhaViewForUser(user.id, user.track_id);

  return (
    <PageShell>
      <Header homeHref="/app" />
      <Container maxWidth={560}>
        <TrilhaAccordion trilha={trilha} nome={user.nome_completo} />
      </Container>
    </PageShell>
  );
}
