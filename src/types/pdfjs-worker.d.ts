/**
 * O pdfjs-dist não publica declaração de tipos para o build do worker
 * importado diretamente (`pdfjs-dist/legacy/build/pdf.worker.mjs`) —
 * usado em `src/lib/kb/pdfExtract.ts` como correção necessária para o
 * bundle serverless da Vercel (o import relativo padrão do pdf.js não
 * resolve nesse ambiente). Esta declaração só resolve o erro de
 * typecheck (`TS7016`); não muda nenhum comportamento em tempo de
 * execução.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
