import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ConteudoPanel } from "./ConteudoPanel";

export default async function ConteudoAdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={920}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Conteúdo dos módulos" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Conteúdo dos módulos</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Adicione ou troque o material de um módulo direto pelo app: um <b>PDF</b>, uma apresentação{" "}
          <b>PowerPoint</b> (convertida em PDF automaticamente) ou o link de um vídeo do <b>YouTube</b>. O arquivo é
          salvo na pasta do módulo no Drive e vale imediatamente para os alunos; o material anterior vai para a
          lixeira do Drive.
        </p>
        <ConteudoPanel />
      </Container>
    </PageShell>
  );
}
