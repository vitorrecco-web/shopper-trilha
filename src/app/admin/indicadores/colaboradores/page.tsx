import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getAllColaboradores } from "@/lib/services/dashboardService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ColaboradoresTable } from "./ColaboradoresTable";

export default async function ColaboradoresIndicadorPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const colaboradores = await getAllColaboradores();

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1100}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Indicadores", href: "/admin/indicadores" },
            { label: "Colaboradores" },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Desempenho por colaborador</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Clique em um colaborador para ver o desempenho módulo a módulo.
        </p>
        <ColaboradoresTable colaboradores={colaboradores} />
      </Container>
    </PageShell>
  );
}
