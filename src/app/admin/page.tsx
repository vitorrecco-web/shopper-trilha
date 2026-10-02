import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { canAccessAdminHub } from "@/lib/auth/roles";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { ClickableCard } from "@/components/ui/Card";

interface HubCard {
  href: string;
  title: string;
  description: string;
  adminOnly: boolean;
}

const cards: HubCard[] = [
  {
    href: "/admin/usuarios",
    title: "Usuários",
    description: "Gerenciar colaboradores e acompanhar progresso",
    adminOnly: true,
  },
  {
    href: "/admin/drive",
    title: "Drive e sincronização",
    description: "Gerenciar conteúdos e sincronizar a trilha",
    adminOnly: true,
  },
  {
    href: "/admin/base-conhecimento",
    title: "Base de Conhecimento",
    description: "Documentos e busca usados pelo Assistente Shopper Trilha",
    adminOnly: true,
  },
  {
    href: "/admin/estrutura",
    title: "Estrutura das trilhas",
    description: "Criar Programas, Fases, Funções e Módulos e, em cada módulo, enviar o material e editar as perguntas",
    adminOnly: true,
  },
  {
    href: "/admin/recrutamento",
    title: "Recrutamento: vagas e áreas",
    description: "Configurar o Programa de Recrutamento, a área de cada fase e as vagas com nota de corte",
    adminOnly: true,
  },
  {
    href: "/admin/indicadores",
    title: "Indicadores",
    description: "Conclusão média, desempenho por módulo e perguntas mais erradas",
    adminOnly: false,
  },
  {
    // Passa por /api/app/trocar-trilha para limpar o Programa escolhido antes
    // e sempre cair no seletor de Programas.
    href: "/api/app/trocar-trilha",
    title: "Ver trilhas (visão de aluno)",
    description: "Percorrer cada Programa como o colaborador vê, com tudo liberado e sem registrar progresso",
    adminOnly: false,
  },
];

export default async function AdminHomePage() {
  // O middleware já barra quem não pode entrar, mas a página confirma de novo
  // (defesa em profundidade — nunca confiar só no middleware).
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!canAccessAdminHub(session.role)) redirect("/app");

  const isAdmin = session.role === "admin";
  const visibleCards = cards.filter((c) => isAdmin || !c.adminOnly);

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={720}>
        <h1 style={{ fontSize: theme.font.size.xxl, marginTop: 0, marginBottom: theme.space(1) }}>
          Painel do Gestor
        </h1>
        <p style={{ color: theme.color.textMuted, fontSize: theme.font.size.base, marginBottom: theme.space(6) }}>
          Olá, {session.nome}.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: theme.space(4),
            marginBottom: theme.space(6),
          }}
        >
          {visibleCards.map((c) => (
            <ClickableCard key={c.href} href={c.href}>
              <h2 style={{ fontSize: theme.font.size.md, margin: 0, marginBottom: 6, color: theme.color.text }}>
                {c.title}
              </h2>
              <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 }}>
                {c.description}
              </p>
            </ClickableCard>
          ))}
        </div>
      </Container>
    </PageShell>
  );
}
