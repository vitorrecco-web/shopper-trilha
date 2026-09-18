import { getCurrentSession } from "@/lib/auth/getSession";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { ClickableCard } from "@/components/ui/Card";

export default async function AdminHomePage() {
  // O middleware já barra quem não é admin, mas a página confirma de novo
  // (defesa em profundidade — nunca confiar só no middleware).
  const session = await getCurrentSession();

  return (
    <PageShell>
      <Header nome={session?.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={720}>
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: theme.space(1) }}>
          Painel do Gestor
        </h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.base, marginBottom: theme.space(6) }}>
          Olá, {session?.nome}.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: theme.space(4),
            marginBottom: theme.space(6),
          }}
        >
          <ClickableCard href="/admin/usuarios">
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, marginBottom: 6, color: theme.color.text }}>
              Usuários
            </h2>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Gerenciar colaboradores e acompanhar progresso
            </p>
          </ClickableCard>

          <ClickableCard href="/admin/drive">
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, marginBottom: 6, color: theme.color.text }}>
              Drive e sincronização
            </h2>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Gerenciar conteúdos e sincronizar a trilha
            </p>
          </ClickableCard>

          <ClickableCard href="/admin/base-conhecimento">
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, marginBottom: 6, color: theme.color.text }}>
              Base de Conhecimento
            </h2>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Documentos e busca usados pelo Assistente Shopper Trilha
            </p>
          </ClickableCard>

          <ClickableCard href="/admin/perguntas">
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, marginBottom: 6, color: theme.color.text }}>
              Editor de Perguntas
            </h2>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Editar e validar o perguntas.json dos módulos sem manipular JSON manualmente
            </p>
          </ClickableCard>

          <ClickableCard href="/admin/indicadores">
            <h2 style={{ fontSize: theme.font.size.md, margin: 0, marginBottom: 6, color: theme.color.text }}>
              Indicadores
            </h2>
            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
              Conclusão média, desempenho por módulo e perguntas mais erradas
            </p>
          </ClickableCard>
        </div>
      </Container>
    </PageShell>
  );
}
