import "server-only";
import { NextResponse } from "next/server";
import { requireAdminOrRespond } from "@/lib/auth/apiGuard";
import { buildSyncPlan, applySyncPlan } from "@/lib/sync/driveSyncService";
import { startSyncPreview, updateSyncStatus, recordSyncChange } from "@/lib/repositories/syncRepository";

/**
 * Fase 5, tarefas 7-9: recalcula o plano do zero (nunca confia num plano
 * vindo do cliente — evita aplicar uma prévia desatualizada se o Drive
 * mudou entre a prévia e a confirmação), aplica (upsert + soft-delete) e
 * registra sync_history + sync_changes.
 */
export async function POST() {
  const guard = await requireAdminOrRespond();
  if ("response" in guard) return guard.response;

  let plan;
  try {
    plan = await buildSyncPlan();
  } catch (err) {
    console.error("Erro ao ler o Drive na confirmação:", err);
    return NextResponse.json(
      { ok: false, error: "Não foi possível ler a estrutura do Drive agora. Nada foi alterado." },
      { status: 502 }
    );
  }

  const syncRecord = await startSyncPreview(guard.session.userId ?? null);

  try {
    await updateSyncStatus(syncRecord.id, "confirmed");

    const summary = await applySyncPlan(plan);

    for (const change of plan.changes) {
      await recordSyncChange({
        sync_id: syncRecord.id,
        entity_type: change.entity_type,
        entity_drive_id: change.entity_drive_id,
        change_type: change.change_type,
        old_value: change.old_value,
        new_value: change.new_value,
      });
    }

    await updateSyncStatus(syncRecord.id, summary.failures.length > 0 ? "failed" : "completed", {
      added_count: summary.counts.added,
      removed_count: summary.counts.removed,
      renamed_count: summary.counts.renamed,
      reordered_count: summary.counts.reordered,
      warnings_count: summary.warningsCount,
      summary: { updated_count: summary.counts.updated, warnings: plan.warnings, failures: summary.failures },
    });

    return NextResponse.json({
      ok: summary.failures.length === 0,
      counts: summary.counts,
      warnings: plan.warnings,
      failures: summary.failures,
      syncId: syncRecord.id,
    });
  } catch (err) {
    console.error("Erro ao aplicar sincronização:", err);
    await updateSyncStatus(syncRecord.id, "failed", {
      summary: { error: err instanceof Error ? err.message : "erro desconhecido" },
    }).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "Falha ao aplicar a sincronização. Veja o histórico para detalhes.", syncId: syncRecord.id },
      { status: 500 }
    );
  }
}
