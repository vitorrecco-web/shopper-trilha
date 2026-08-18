import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { buildSyncPlan } from "@/lib/sync/driveSyncService";
import { getLastSync } from "@/lib/repositories/syncRepository";

/**
 * Fase 5, tarefas 1-6: compara Drive x banco e devolve a prévia.
 * Não grava absolutamente nada — nem mesmo um registro de sync_history
 * (§8, tarefa 6: "cancelar sem alterar banco"). A gravação só acontece
 * em /api/admin/sync/confirm, e mesmo assim recalcula tudo do zero.
 */
export async function GET() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  try {
    const [plan, lastSync] = await Promise.all([buildSyncPlan(), getLastSync()]);
    return NextResponse.json({
      ok: true,
      changes: plan.changes,
      warnings: plan.warnings,
      lastSync: lastSync
        ? { status: lastSync.status, startedAt: lastSync.started_at, completedAt: lastSync.completed_at }
        : null,
    });
  } catch (err) {
    console.error("Erro ao gerar prévia de sincronização:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Não foi possível ler a estrutura do Drive agora. Verifique as credenciais e a permissão de acesso à pasta.",
      },
      { status: 502 }
    );
  }
}
