import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copia o worker do pdfjs-dist para public/, fora do pipeline do
 * webpack. Necessário porque o worker é um módulo ESM (import/export) e
 * o Terser (minificador de produção do Next) quebra ao tentar processá-lo
 * como script comum se ele for referenciado via `new URL(..., import.meta.url)`
 * (que faz o webpack "adotar" o arquivo).
 *
 * Roda automaticamente no "postinstall" — se a versão do pdfjs-dist for
 * atualizada no futuro, um `npm install` já recopia o worker certo.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const source = join(projectRoot, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = join(projectRoot, "public");
const dest = join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);

console.log("pdf.worker.min.mjs copiado para public/");
