import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { KbPanel } from "./KbPanel";

export default async function BaseConhecimentoPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={780}>
        <Breadcrumb items={[{ label: "Painel do Gestor", href: "/admin" }, { label: "Base de Conhecimento" }]} />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Base de Conhecimento</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Fase 1 do Assistente Shopper: indexação dos documentos em <code>Trilha de Liderança / documentos/</code> e
          teste de busca semântica. Totalmente separado da sincronização da trilha — sem chat visual ainda, sem
          geração de resposta por IA ainda.
        </p>
        <KbPanel />
      </Container>
    </PageShell>
  );
}
