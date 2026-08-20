import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUserOrRespond } from "@/lib/auth/apiGuard";
import { getModuleAccessInfo, VIDEO_WATCHED_THRESHOLD_PERCENT } from "@/lib/services/moduleAccessService";
import { markMaterialAccessed, updateVideoWatchedPercent } from "@/lib/repositories/userModulesRepository";

const bodySchema = z.object({
  percent: z.number().min(0).max(100),
});

/**
 * Recebe o percentual assistido reportado pelo player (YouTube IFrame
 * API, client-side). Só módulos com material_type='youtube' aceitam
 * essa rota. O primeiro report já conta como "primeiro acesso ao
 * material" (mesmo papel que a Fase 8 dá ao primeiro fetch do PDF).
 *
 * Limitação conhecida (documentada no README): o percentual é
 * autorreportado pelo cliente — não há verificação server-side de que o
 * vídeo foi de fato reproduzido nesse ritmo. Mesmo trade-off já aceito
 * para material_accessed em geral.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireActiveUserOrRespond();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const access = await getModuleAccessInfo(user.id, user.track_id, params.id);
  if (!access || !access.unlocked || access.module.material_type !== "youtube") {
    return NextResponse.json({ ok: false, error: "Módulo não disponível." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  await markMaterialAccessed(user.id, access.module.id);
  const videoWatchedPercent = await updateVideoWatchedPercent(user.id, access.module.id, parsed.data.percent);

  return NextResponse.json({
    ok: true,
    videoWatchedPercent,
    thresholdReached: videoWatchedPercent >= VIDEO_WATCHED_THRESHOLD_PERCENT,
  });
}
