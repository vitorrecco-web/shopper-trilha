import "server-only";
import { z } from "zod";

/**
 * Espelha exatamente o formato de perguntas-modelo.json:
 * - cada pergunta tem exatamente 4 alternativas (§4);
 * - a resposta correta é vinculada por ID interno, nunca pela posição
 *   visual (§4) — por isso `correta` é validado contra os IDs de
 *   `alternativas`, nunca contra um índice;
 * - `explicacao` é opcional (§4).
 *
 * NOVO — revisão pós-reprovação (Assistente Shopper): três campos
 * opcionais que indicam qual CONTEÚDO revisar quando o aluno errar essa
 * pergunta. Nunca guardam gabarito, só "onde estudar":
 * - `review_topic`: termos de busca (ex: "produto avariado descarte").
 * - `review_process`: nome do processo/pasta no Drive (ex: "PICKING"),
 *   usado como `process_key` na busca — restringe a Processos/PICKING/.
 * - `review_document`: pista do documento a priorizar (ex: "POP
 *   PICKING") — corresponde por substring normalizado, nunca por nome
 *   exato de arquivo (os PDFs reais têm nomes irregulares, tipo "Cópia
 *   de POP PICKING - 07.08.2026.docx.pdf").
 * Totalmente opcionais — todo `perguntas.json` já publicado continua
 * validando exatamente igual, sem nenhum backfill necessário.
 */

const alternativaSchema = z.object({
  id: z.string().min(1),
  texto: z.string().min(1),
});

const perguntaSchema = z
  .object({
    id: z.string().min(1),
    pergunta: z.string().min(1),
    alternativas: z.array(alternativaSchema).length(4, "cada pergunta precisa ter exatamente 4 alternativas"),
    correta: z.string().min(1),
    explicacao: z.string().optional(),
    review_topic: z.string().min(1).optional(),
    review_process: z.string().min(1).optional(),
    review_document: z.string().min(1).optional(),
  })
  .refine((p) => p.alternativas.some((a) => a.id === p.correta), {
    message: "o campo 'correta' precisa apontar para o id de uma das alternativas",
  });

const perguntasFileSchema = z.object({
  perguntas: z.array(perguntaSchema).min(1, "o arquivo precisa ter pelo menos 1 pergunta"),
});

export type ValidatedPerguntas = z.infer<typeof perguntasFileSchema>;

export type ValidationResult = { ok: true; data: ValidatedPerguntas } | { ok: false; error: string };

/**
 * §8.1: "Se perguntas.json existir, validar antes de uso. Se for
 * inválido: mostrar aviso na prévia; não quebrar o módulo; publicar o
 * módulo como se estivesse sem perguntas até o JSON ser corrigido."
 *
 * Esta função só valida — quem chama decide o que fazer com o resultado
 * (driveSyncService.ts rebaixa o módulo para has_questions=false).
 */
export function validatePerguntasJson(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON malformado" };
  }

  const result = perguntasFileSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first ? `${first.path.join(".") || "arquivo"}: ${first.message}` : "formato inválido" };
  }

  const ids = result.data.perguntas.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "há perguntas com o mesmo 'id' duplicado" };
  }

  return { ok: true, data: result.data };
}
