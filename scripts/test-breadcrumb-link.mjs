#!/usr/bin/env node
/**
 * Teste automatizado/estrutural — PATCH CORRETIVO, Prioridade 2.
 *
 * Garante que "Minha Trilha" em /app/modulo/[id] é um next/link real
 * com href="/app", em vez de um elemento visualmente parecido com link
 * mas sem navegação. Cobre em duas camadas:
 *
 * 1. Lógica pura (`isBreadcrumbItemLink`, extraída de Breadcrumb.tsx):
 *    prova que um item não-último com `href` sempre é considerado link.
 * 2. Renderização real do componente (`renderToStaticMarkup`): monta o
 *    <Breadcrumb> de verdade com os MESMOS itens que a página do módulo
 *    usa, e verifica que o HTML resultante contém um <a href="/app">
 *    de verdade — não uma reimplementação da lógica, o componente real.
 * 3. Checagem estrutural do código-fonte: confirma que
 *    src/app/app/modulo/[id]/page.tsx ainda passa `href: "/app"` junto
 *    de "Minha Trilha" — protege contra uma edição futura remover isso
 *    sem querer, mesmo que o componente Breadcrumb continue correto.
 *
 * Rodar com: node scripts/test-breadcrumb-link.mjs
 * (compila as fontes TS/TSX num diretório temporário via tsc — não
 * precisa de Jest/Vitest nem de nenhuma dependência nova.)
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(fileURLToPath(import.meta.url), "..", "..");
const assertions = [];

function assert(condition, description) {
  assertions.push([Boolean(condition), description]);
}

// ---- 1 + 2: compila Breadcrumb.tsx real + um harness de render num diretório temporário ----
const workDir = mktempCompatible();

function mktempCompatible() {
  return mkdtempSync(join(projectRoot, ".tmp-breadcrumb-test-"));
}

const breadcrumbSrc = readFileSync(join(projectRoot, "src/components/ui/Breadcrumb.tsx"), "utf8")
  .replace('import { theme } from "@/lib/ui/theme";', 'import { theme } from "./theme-fixture.js";')
  .replace('import Link from "next/link";', 'import Link from "./next-link-shim.js";');

writeFileSync(
  join(workDir, "next-link-shim.tsx"),
  `// Shim de next/link: mesma interface (href + children + o resto vira
  // atributos do <a>), só para isolar o teste da resolução de tipos
  // interna do Next — o que queremos testar aqui é a lógica condicional
  // do Breadcrumb (isBreadcrumbItemLink), não a biblioteca do Next em
  // si (essa já é testada pelo próprio Next.js).
  export default function Link({ href, children, ...rest }) {
    return <a href={href} {...rest}>{children}</a>;
  }`
);

writeFileSync(join(workDir, "Breadcrumb.tsx"), breadcrumbSrc);
writeFileSync(
  join(workDir, "theme-fixture.ts"),
  `export const theme = {
    color: { textFaint: "#8A928D", primaryDark: "#178C64", text: "#1B1F1D", textMuted: "#5C6560" },
    font: { size: { sm: 13 } },
    space: (n) => n * 4 + "px",
  };`
);
writeFileSync(
  join(workDir, "harness.tsx"),
  `import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumb, isBreadcrumbItemLink } from "./Breadcrumb.js";

// Mesmos itens exatos usados por src/app/app/modulo/[id]/page.tsx
const items = [{ label: "Minha Trilha", href: "/app" }, { label: "Módulo de exemplo" }];
const html = renderToStaticMarkup(Breadcrumb({ items }));

console.log("__HTML_START__");
console.log(html);
console.log("__HTML_END__");

console.log("__LOGIC_START__");
console.log(JSON.stringify({
  primeiroItemComHrefNaoUltimo: isBreadcrumbItemLink({ label: "A", href: "/x" }, false),
  ultimoItemComHref: isBreadcrumbItemLink({ label: "B", href: "/y" }, true),
  itemSemHref: isBreadcrumbItemLink({ label: "C" }, false),
}));
console.log("__LOGIC_END__");
`
);
writeFileSync(
  join(workDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "dist",
        esModuleInterop: true,
        jsx: "react-jsx",
        strict: false,
        skipLibCheck: true,
        typeRoots: [join(projectRoot, "node_modules/@types")],
      },
      include: ["*.ts", "*.tsx"],
    },
    null,
    2
  )
);

mkdirSync(join(workDir, "node_modules"), { recursive: true });
// Reaproveita react/react-dom já instalados no projeto, sem duplicar.
writeFileSync(
  join(workDir, "package.json"),
  JSON.stringify({ type: "module" })
);

let compileOk = true;
let compileError = "";
try {
  execFileSync("npx", ["--no-install", "tsc", "-p", "tsconfig.json"], {
    cwd: workDir,
    stdio: "pipe",
    env: { ...process.env, NODE_PATH: join(projectRoot, "node_modules") },
  });
} catch (err) {
  compileOk = false;
  compileError = err.stdout?.toString() ?? err.message;
}
assert(compileOk, `Breadcrumb.tsx (código real) compila sem erros${compileOk ? "" : `: ${compileError}`}`);

let html = "";
let logic = null;
if (compileOk) {
  try {
    const output = execFileSync("node", ["dist/harness.js"], {
      cwd: workDir,
      env: { ...process.env, NODE_PATH: join(projectRoot, "node_modules") },
    }).toString();
    html = output.split("__HTML_START__")[1]?.split("__HTML_END__")[0]?.trim() ?? "";
    const logicRaw = output.split("__LOGIC_START__")[1]?.split("__LOGIC_END__")[0]?.trim();
    logic = logicRaw ? JSON.parse(logicRaw) : null;
  } catch (err) {
    assert(false, `harness de render executa sem erros: ${err.stdout?.toString() ?? err.message}`);
  }
}

if (logic) {
  assert(logic.primeiroItemComHrefNaoUltimo === true, "item não-último com href deve ser considerado link");
  assert(logic.ultimoItemComHref === false, "item ÚLTIMO com href NÃO deve virar link (é a página atual)");
  assert(logic.itemSemHref === false, "item sem href não deve virar link");
}

if (html) {
  assert(/<a[^>]+href="\/app"[^>]*>Minha Trilha<\/a>/.test(html), '"Minha Trilha" deve renderizar como <a href="/app">Minha Trilha</a> de verdade');
  assert(!/<a[^>]*>Módulo de exemplo<\/a>/.test(html), 'o último item (nome do módulo) NÃO deve virar <a> — é a página atual');
}

// ---- 3: checagem estrutural do código-fonte real da página do módulo ----
const modulePageSrc = readFileSync(
  join(projectRoot, "src/app/app/modulo/[id]/page.tsx"),
  "utf8"
);
assert(
  /label:\s*"Minha Trilha"\s*,\s*href:\s*"\/app"/.test(modulePageSrc),
  'src/app/app/modulo/[id]/page.tsx deve conter literalmente { label: "Minha Trilha", href: "/app" }'
);
assert(
  /<Link\s+href="\/app"/.test(modulePageSrc) && /Voltar para Minha Trilha/.test(modulePageSrc),
  'src/app/app/modulo/[id]/page.tsx deve conter um <Link href="/app"> real com o texto "Voltar para Minha Trilha", independente do breadcrumb'
);

// ---- limpeza ----
rmSync(workDir, { recursive: true, force: true });

// ---- resultado ----
let failed = 0;
for (const [ok, desc] of assertions) {
  console.log(`${ok ? "✅" : "❌"} ${desc}`);
  if (!ok) failed++;
}
if (failed > 0) {
  console.error(`\n${failed} de ${assertions.length} asserção(ões) falharam.`);
  process.exit(1);
}
console.log(`\nTodas as ${assertions.length} asserções passaram.`);
