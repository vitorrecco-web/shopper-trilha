import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserWithTrackById } from "@/lib/repositories/usersRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { listAttemptsForUser } from "@/lib/repositories/quizAttemptsRepository";
import { computeUserProgress } from "@/lib/services/userProgress";
import { UserDetail } from "./UserDetail";

export default async function UsuarioDetalhePage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const user = await getUserWithTrackById(params.id);
  if (!user) notFound();

  const [modules, userModules, attempts, progress] = await Promise.all([
    listActiveModulesForTrack(user.track_id),
    listUserModules(user.id),
    listAttemptsForUser(user.id),
    computeUserProgress(user.id, user.track_id),
  ]);

  const modulesDetail = modules.map((m) => {
    const um = userModules.find((x) => x.module_id === m.id);
    return {
      module_id: m.id,
      nome: m.nome,
      ordem: m.ordem,
      unlocked_at: um?.unlocked_at ?? null,
      material_accessed: um?.material_accessed ?? false,
      material_accessed_at: um?.material_accessed_at ?? null,
      completed: um?.completed ?? false,
      completed_at: um?.completed_at ?? null,
      best_score: um?.best_score ?? null,
    };
  });

  return (
    <main style={{ padding: 24, maxWidth: 680, margin: "0 auto" }}>
      <p style={{ fontSize: 13, marginBottom: 16 }}>
        <Link href="/admin/usuarios" style={{ color: "#9aa0a6" }}>
          ← Usuários
        </Link>
      </p>

      <UserDetail
        user={{
          id: user.id,
          nome_completo: user.nome_completo,
          matricula: user.matricula,
          login: user.login,
          track_nome: user.track?.nome ?? "—",
          cd: user.cd,
          turno: user.turno,
          status: user.status,
          created_at: user.created_at,
          last_login_at: user.last_login_at,
        }}
        progress={progress}
        modules={modulesDetail}
        attempts={attempts.map((a) => ({
          id: a.id,
          module_id: a.module_id,
          score: a.score,
          correct_answers: a.correct_answers,
          total_questions: a.total_questions,
          passed: a.passed,
          started_at: a.started_at,
          submitted_at: a.submitted_at,
        }))}
      />
    </main>
  );
}
