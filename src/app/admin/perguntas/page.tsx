import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PerguntasEditorPanel } from "./PerguntasEditorPanel";

export default async function PerguntasAdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={920}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Editor de Perguntas" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Editor de Perguntas</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Edite e valide o <code>perguntas.json</code> de um módulo sem precisar manipular JSON manualmente.
          "Salvar no Drive" sobrescreve o arquivo do módulo direto na pasta correspondente — vale imediatamente
          para o próximo quiz respondido. O botão de backup baixa uma cópia local antes de salvar.
        </p>
        <PerguntasEditorPanel />
      </Container>
    </PageShell>
  );
}
