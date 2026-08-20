import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { getModuleAccessInfo } from "@/lib/services/moduleAccessService";
import { ModuloClient } from "./ModuloClient";

/**
 * Fase 8, tarefa 1 (§10.3): página própria por módulo, só acessível se
 * liberado. Se não existir/não for aplicável, 404. Se existir mas
 * estiver bloqueado, volta para Minha Trilha em vez de mostrar conteúdo
 * — a mesma regra aplicada pelas rotas de PDF/quiz.
 */
export default async function ModuloPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.userId);
  if (!user || user.status === "inactive") redirect("/login");

  const access = await getModuleAccessInfo(user.id, user.track_id, params.id);
  if (!access) notFound();
  if (!access.unlocked) redirect("/app");

  return (
    <main style={{ padding: "16px 16px 40px", maxWidth: 640, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: 12 }}>
        <Link href="/app" style={{ color: "#9aa0a6" }}>
          ← Minha Trilha
        </Link>
      </p>
      <p style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 2 }}>{access.phaseNome}</p>
      <h1 style={{ fontSize: 19, marginTop: 0, marginBottom: 16 }}>{access.module.nome}</h1>

      <ModuloClient
        moduleId={access.module.id}
        materialType={access.module.material_type}
        hasQuestions={access.module.has_questions}
        videoExternalId={access.module.video_external_id}
        videoTitulo={access.module.video_titulo}
        initialMaterialAccessed={access.materialAccessed}
        initialVideoWatchedPercent={access.videoWatchedPercent}
        initialCompleted={access.completed}
        initialBestScore={access.bestScore}
        nextModuleId={access.nextModuleId}
        nextModuleNome={access.nextModuleNome}
      />
    </main>
  );
}
