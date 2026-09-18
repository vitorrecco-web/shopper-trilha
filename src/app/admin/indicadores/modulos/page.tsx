import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getAllModulePerformance } from "@/lib/services/dashboardService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ModulosTable } from "./ModulosTable";

export default async function ModulosIndicadorPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const modules = await getAllModulePerformance();

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={1000}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Indicadores", href: "/admin/indicadores" },
            { label: "Módulos" },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>Desempenho por módulo</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          Clique em um módulo para ver o desempenho por colaborador nele.
        </p>
        <ModulosTable modules={modules} />
      </Container>
    </PageShell>
  );
}
