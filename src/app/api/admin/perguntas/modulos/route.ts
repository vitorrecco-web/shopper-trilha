import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listAllModules } from "@/lib/repositories/modulesRepository";
import { listAllPhases } from "@/lib/repositories/phasesRepository";
import { listAllTracks } from "@/lib/repositories/tracksRepository";

/**
 * Editor visual de perguntas (Admin) — lista só módulos que já têm um
 * perguntas.json mapeado do Drive (questions_drive_id preenchido),
 * incluindo os com validação atualmente inválida (has_questions=false),
 * para o admin poder abrir e corrigir.
 */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  try {
    const [modules, phases, tracks] = await Promise.all([
      listAllModules(),
      listAllPhases(),
      listAllTracks(),
    ]);

    const phaseById = new Map(phases.map((p) => [p.id, p]));
    const trackById = new Map(tracks.map((t) => [t.id, t]));

    const withQuiz = modules
      .filter((m) => Boolean(m.questions_drive_id))
      .map((m) => ({
        id: m.id,
        nome: m.nome,
        faseNome: phaseById.get(m.phase_id)?.nome ?? null,
        trackNome: m.track_id ? (trackById.get(m.track_id)?.nome ?? null) : null,
        hasQuestions: m.has_questions,
        active: m.active,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return NextResponse.json({ ok: true, modules: withQuiz });
  } catch (err) {
    console.error("Erro ao listar módulos com quiz:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível listar os módulos agora." }, { status: 500 });
  }
}
