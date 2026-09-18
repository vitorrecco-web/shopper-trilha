import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getAllWrongQuestions } from "@/lib/services/dashboardService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PerguntasErradasTable } from "./PerguntasErradasTable";

export default async function PerguntasErradasPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const questions = await getAllWrongQuestions();

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={900}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Indicadores", href: "/admin/indicadores" },
            { label: "Perguntas mais erradas" },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Perguntas mais erradas</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Ordenado pela taxa de erro — considera o histórico de tentativas (mesmo que a pergunta já tenha
          mudado no perguntas.json atual).
        </p>
        <PerguntasErradasTable questions={questions} />
      </Container>
    </PageShell>
  );
}
