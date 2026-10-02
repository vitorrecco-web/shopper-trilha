import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { listVacancies, listInterestsForUser } from "@/lib/repositories/recruitmentRepository";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { InteresseForm } from "./InteresseForm";

/** "Quais vagas te interessam?" — mostrada ao entrar na trilha de Recrutamento e editável depois. */
export default async function InteressePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");
  if (user.role !== "student") redirect("/app");

  const [vacancies, interests] = await Promise.all([listVacancies({ onlyActive: true }), listInterestsForUser(user.id)]);
  if (vacancies.length === 0) redirect("/app");

  return (
    <PageShell>
      <Header homeHref="/app" />
      <Container maxWidth={560}>
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Quais vagas te interessam?</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Olá, {user.nome_completo}. Escolha uma ou mais vagas — isso ajuda a direcionar seu caminho. Você pode mudar
          depois e, se ainda não sabe, tudo bem.
        </p>
        <InteresseForm
          vacancies={vacancies.map((v) => ({ id: v.id, nome: v.nome }))}
          initialSelected={interests.map((i) => i.vacancy_id)}
        />
      </Container>
    </PageShell>
  );
}
