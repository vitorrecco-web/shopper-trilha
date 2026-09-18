import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserModuleHistory } from "@/lib/services/dashboardService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Badge } from "@/components/ui/Badge";

const boxStyle: React.CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.sm,
  padding: theme.space(4),
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function ColaboradorIndicadorPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const data = await getUserModuleHistory(params.id);
  if (!data) notFound();

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={900}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Indicadores", href: "/admin/indicadores" },
            { label: "Colaboradores", href: "/admin/indicadores/colaboradores" },
            { label: data.nomeCompleto },
          ]}
        />
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: 4 }}>{data.nomeCompleto}</h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm, marginBottom: theme.space(5) }}>
          {data.trackNome ?? "Sem trilha"} · Desempenho em quiz por módulo — quem ainda não passou aparece
          primeiro.{" "}
          <Link href={`/admin/usuarios/${data.userId}`} style={{ color: theme.color.primaryDark }}>
            Ver cadastro completo →
          </Link>
        </p>

        <div style={boxStyle}>
          {data.rows.length === 0 ? (
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Este colaborador ainda não tentou nenhum quiz.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: theme.color.textFaint, fontSize: theme.font.size.xs }}>
                    <th style={{ padding: "6px 8px" }}>Módulo</th>
                    <th style={{ padding: "6px 8px" }}>Tentativas</th>
                    <th style={{ padding: "6px 8px" }}>Melhor nota</th>
                    <th style={{ padding: "6px 8px" }}>Última nota</th>
                    <th style={{ padding: "6px 8px" }}>Situação</th>
                    <th style={{ padding: "6px 8px" }}>Última tentativa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.moduleId} style={{ borderTop: `1px solid ${theme.color.border}` }}>
                      <td style={{ padding: "8px", fontWeight: 600 }}>
                        <Link
                          href={`/admin/indicadores/modulo/${row.moduleId}`}
                          style={{ color: theme.color.primaryDark, textDecoration: "none" }}
                        >
                          {row.moduleNome}
                        </Link>
                      </td>
                      <td style={{ padding: "8px" }}>{row.attempts}</td>
                      <td style={{ padding: "8px" }}>{row.bestScore}%</td>
                      <td style={{ padding: "8px" }}>{row.lastScore}%</td>
                      <td style={{ padding: "8px" }}>
                        <Badge tone={row.passed ? "primary" : "danger"}>
                          {row.passed ? "Aprovado" : "Não aprovado"}
                        </Badge>
                      </td>
                      <td style={{ padding: "8px", color: theme.color.textMuted }}>
                        {formatDate(row.lastAttemptAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
