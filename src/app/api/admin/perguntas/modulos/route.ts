import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { listAllModules } from "@/lib/repositories/modulesRepository";
import { listAllPhases } from "@/lib/repositories/phasesRepository";
import { listAllTracks } from "@/lib/repositories/tracksRepository";
import { listAllPrograms } from "@/lib/repositories/programsRepository";

/**
 * Editor visual de perguntas (Admin) — lista TODOS os módulos (com ou sem
 * perguntas.json mapeado no Drive ainda). Um módulo sem arquivo é editável
 * do mesmo jeito; "Salvar no Drive" cria o perguntas.json na pasta do
 * módulo na primeira vez (ver /api/admin/perguntas/salvar). `hasQuestionsFile`
 * diferencia os dois casos na lista; `hasQuestions` continua indicando se
 * o arquivo MAPEADO hoje é válido.
 */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  try {
    const [modules, phases, tracks, programs] = await Promise.all([
      listAllModules(),
      listAllPhases(),
      listAllTracks(),
      listAllPrograms(),
    ]);

    const phaseById = new Map(phases.map((p) => [p.id, p]));
    const trackById = new Map(tracks.map((t) => [t.id, t]));
    const programById = new Map(programs.map((p) => [p.id, p]));

    // Ordenado pela ordem real da trilha (Programa -> fase -> trilha ->
    // módulo), não alfabeticamente pelo nome — com muitos módulos, ordem
    // alfabética espalha os módulos de uma mesma fase/trilha pela lista
    // inteira e torna impossível achar o que se procura (feedback do admin).
    const withQuiz = modules
      .map((m) => {
        const phase = phaseById.get(m.phase_id);
        const program = phase ? programById.get(phase.program_id) : undefined;
        return {
          id: m.id,
          nome: m.nome,
          ordem: m.ordem,
          programId: program?.id ?? null,
          programNome: program?.nome ?? null,
          faseNome: phase?.nome ?? null,
          faseOrdem: phase?.ordem ?? Number.MAX_SAFE_INTEGER,
          phaseType: phase?.phase_type ?? "common",
          trackNome: m.track_id ? (trackById.get(m.track_id)?.nome ?? null) : null,
          hasQuestionsFile: Boolean(m.questions_drive_id),
          hasQuestions: m.has_questions,
          active: m.active,
        };
      })
      .sort((a, b) => {
        const aProgram = a.programNome ?? "";
        const bProgram = b.programNome ?? "";
        if (aProgram !== bProgram) return aProgram.localeCompare(bProgram, "pt-BR");
        if (a.faseOrdem !== b.faseOrdem) return a.faseOrdem - b.faseOrdem;
        const aTrack = a.trackNome ?? "";
        const bTrack = b.trackNome ?? "";
        if (aTrack !== bTrack) return aTrack.localeCompare(bTrack, "pt-BR");
        return a.ordem - b.ordem;
      });

    return NextResponse.json({ ok: true, modules: withQuiz });
  } catch (err) {
    console.error("Erro ao listar módulos com quiz:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Não foi possível listar os módulos agora." }, { status: 500 });
  }
}
