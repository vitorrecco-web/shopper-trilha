import "server-only";
import { z } from "zod";

/**
 * video.json — material principal em vídeo. Formato:
 *   { "tipo": "youtube", "url": "...", "titulo"?: "..." }
 *
 * Só "tipo": "youtube" é suportado por enquanto — qualquer outro valor é
 * tratado como inválido (mesmo tratamento de perguntas.json inválido:
 * aviso, módulo fica sem material principal até ser corrigido, nunca
 * quebra a sincronização).
 */

const videoJsonSchema = z.object({
  tipo: z.string().min(1),
  url: z.string().min(1),
  titulo: z.string().optional(),
});

export interface ValidatedVideo {
  provider: "youtube";
  videoId: string;
  titulo: string | null;
}

export type VideoValidationResult = { ok: true; data: ValidatedVideo } | { ok: false; error: string };

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extrai o ID de 11 caracteres de:
 * - https://www.youtube.com/watch?v=ID (com ou sem "www"/"m.", outros
 *   parâmetros de query são ignorados)
 * - https://youtu.be/ID
 * - .../embed/ID e .../shorts/ID, por robustez extra
 * Retorna null se a URL não for reconhecida ou o ID não tiver o formato
 * esperado — nunca lança.
 */
export function extractYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtube.com") {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      if (v && YOUTUBE_ID_RE.test(v)) return v;
      return null;
    }
    const embedMatch = /^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/.exec(url.pathname);
    return embedMatch ? embedMatch[1] : null;
  }

  if (host === "youtu.be") {
    const segment = url.pathname.replace(/^\//, "").split("/")[0];
    return YOUTUBE_ID_RE.test(segment) ? segment : null;
  }

  return null;
}

export function validateVideoJson(raw: string): VideoValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON malformado" };
  }

  const result = videoJsonSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: first ? `${first.path.join(".") || "arquivo"}: ${first.message}` : "formato inválido",
    };
  }

  if (result.data.tipo !== "youtube") {
    return {
      ok: false,
      error: `tipo de vídeo não suportado: "${result.data.tipo}" (só "youtube" por enquanto)`,
    };
  }

  const videoId = extractYoutubeVideoId(result.data.url);
  if (!videoId) {
    return { ok: false, error: `não foi possível extrair o ID do vídeo da URL "${result.data.url}"` };
  }

  return {
    ok: true,
    data: { provider: "youtube", videoId, titulo: result.data.titulo?.trim() || null },
  };
}
