import { redirect, notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/getSession";
import { getUserById } from "@/lib/repositories/usersRepository";
import { listActiveEnrollmentsForUser } from "@/lib/repositories/enrollmentsRepository";
import { listActivePrograms } from "@/lib/repositories/programsRepository";
import { listActivePhases } from "@/lib/repositories/phasesRepository";
import { listActiveModulesForTrack } from "@/lib/repositories/modulesRepository";
import { listUserModules } from "@/lib/repositories/userModulesRepository";
import { listAttemptsForUser } from "@/lib/repositories/quizAttemptsRepository";
import { computeUsersProgressBatch } from "@/lib/services/userProgress";
import { buildOrderedModules } from "@/lib/services/trilhaView";
import { Header } from "@/components/ui/Header";
import { PageShell, Container } from "@/components/ui/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { UserDetail } from "./UserDetail";

export default async function UsuarioDetalhePage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/app");

  const user = await getUserById(params.id);
  if (!user) notFound();

  const [enrollments, allPrograms, userModules, attempts] = await Promise.all([
    listActiveEnrollmentsForUser(user.id),
    listActivePrograms(),
    listUserModules(user.id),
    listAttemptsForUser(user.id),
  ]);

  const progressByUserId = await computeUsersProgressBatch([
    { id: user.id, enrollments: enrollments.map((e) => ({ program_id: e.program_id, track_id: e.track_id })) },
  ]);
  const progress = progressByUserId.get(user.id) ?? { totalModules: 0, completedModules: 0, percent: null };

  // buildOrderedModules (já usada na Fase 6/7 para "Minha Trilha") ordena
  // por ordem da FASE primeiro, depois ordem do módulo dentro dela — o
  // que faltava aqui, causando Módulo 1 de fases diferentes agrupados
  // (listActiveModulesForTrack só ordena pelo campo `ordem` do módulo,
  // que reinicia a cada fase). Agora soma os módulos de TODAS as
  // matrículas ativas da pessoa, cada um já marcado com o Programa dele.
  const modulesDetail: Array<{
    module_id: string;
    nome: string;
    ordem: number;
    phase_id: string;
    phase_nome: string;
    phase_ordem: number;
    program_nome: string;
    has_questions: boolean;
    unlocked_at: string | null;
    material_accessed: boolean;
    material_accessed_at: string | null;
    completed: boolean;
    completed_at: string | null;
    best_score: number | null;
  }> = [];

  for (const enrollment of enrollments) {
    const [phases, modules] = await Promise.all([
      listActivePhases(enrollment.program_id),
      listActiveModulesForTrack(enrollment.program_id, enrollment.track_id),
    ]);
    const orderedModules = buildOrderedModules(phases, modules);
    const phaseById = new Map(phases.map((p) => [p.id, p]));

    for (const m of orderedModules) {
      const um = userModules.find((x) => x.module_id === m.id);
      const phase = phaseById.get(m.phase_id);
      modulesDetail.push({
        module_id: m.id,
        nome: m.nome,
        ordem: m.ordem,
        phase_id: m.phase_id,
        phase_nome: phase?.nome ?? "—",
        phase_ordem: phase?.ordem ?? 0,
        program_nome: enrollment.program_nome,
        has_questions: m.has_questions,
        unlocked_at: um?.unlocked_at ?? null,
        material_accessed: um?.material_accessed ?? false,
        material_accessed_at: um?.material_accessed_at ?? null,
        completed: um?.completed ?? false,
        completed_at: um?.completed_at ?? null,
        best_score: um?.best_score ?? null,
      });
    }
  }

  return (
    <PageShell>
      <Header nome={session.nome} context="Painel do Gestor" homeHref="/admin" />
      <Container maxWidth={760}>
        <Breadcrumb
          items={[
            { label: "Painel do Gestor", href: "/admin" },
            { label: "Usuários", href: "/admin/usuarios" },
            { label: user.nome_completo },
          ]}
        />

        <UserDetail
          user={{
            id: user.id,
            nome_completo: user.nome_completo,
            matricula: user.matricula,
            login: user.login,
            cd: user.cd,
            turno: user.turno,
            status: user.status,
            role: user.role,
            created_at: user.created_at,
            last_login_at: user.last_login_at,
          }}
          enrollments={enrollments.map((e) => ({
            id: e.id,
            program_id: e.program_id,
            program_nome: e.program_nome,
            track_nome: e.track_nome,
          }))}
          allPrograms={allPrograms.map((p) => ({ id: p.id, nome: p.nome }))}
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
      </Container>
    </PageShell>
  );
}
