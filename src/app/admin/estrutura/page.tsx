import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EstruturaPanel } from "./EstruturaPanel";

export default async function EstruturaAdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={920}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Estrutura das trilhas" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Estrutura das trilhas</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Crie e organize <b>Programas</b>, <b>Fases</b>, <b>Funções</b> e <b>Módulos</b> direto pelo app. Cada item é
          criado também como pasta no Drive (e a sincronização reconhece tudo sem mudanças). Em cada módulo,
          use <b>Material</b> para enviar o PDF, o PowerPoint ou o link do YouTube e <b>Perguntas</b> para criar ou
          editar o quiz. Remover manda a pasta para a lixeira do Drive (reversível) e tira o item das trilhas.
        </p>
        <EstruturaPanel />
      </Container>
    </PageShell>
  );
}
