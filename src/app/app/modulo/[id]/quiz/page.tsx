import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { getModuleAccessInfo } from "@/lib/services/moduleAccessService";
import { theme } from "@/lib/ui/theme";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { QuizClient } from "./QuizClient";

/**
 * Página própria da prova — mesmas regras de acesso da página do
 * módulo (liberado, material acessado, e para vídeo, percentual
 * mínimo assistido), replicadas aqui só para não deixar a URL acessível
 * "no escuro" antes da hora. A autorização de verdade continua nas
 * rotas de API (`/api/modulos/[id]/quiz`), inalteradas.
 */
export default async function QuizPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");

  const moduleHref = `/app/modulo/${params.id}`;
  const access = await getModuleAccessInfo(user.id, user.track_id, params.id);
  if (!access) notFound();
  if (!access.unlocked || !access.module.has_questions) redirect(moduleHref);
  if (!access.materialAccessed) redirect(moduleHref);
  if (access.module.material_type === "youtube" && !access.videoThresholdReached) redirect(moduleHref);

  return (
    <PageShell>
      <Header homeHref="/app" />
      <Container maxWidth={640}>
        <Link
          href={moduleHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: theme.font.size.base,
            fontWeight: 700,
            color: theme.color.primaryDark,
            textDecoration: "none",
            padding: "10px 4px",
            marginBottom: theme.space(3),
            minHeight: 44,
          }}
        >
          ← Voltar
        </Link>

        <p style={{ fontSize: theme.font.size.xs, color: theme.color.textFaint, marginBottom: 2 }}>Avaliação</p>
        <h1 style={{ fontSize: theme.font.size.xl, marginTop: 0, marginBottom: theme.space(4), color: theme.color.text }}>
          {access.module.nome}
        </h1>

        <QuizClient moduleId={params.id} moduleHref={moduleHref} />
      </Container>
    </PageShell>
  );
}
