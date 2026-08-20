# Roteiro de teste visual — REDESIGN V1

## 0. Antes de testar

Aplique o patch por cima do repositório, `npm install`, `npm run build` local pra confirmar, depois `git add . && git commit && git push`.

## Desktop (janela larga, ~1280px+)

1. Acesse a URL de produção sem estar logado → deve cair direto em `/login`, sem passar por nenhuma página técnica.
2. `/login` — confira o logo Shopper real no topo, card branco centralizado, botão verde, boa distância das bordas da tela.
3. Logue como **admin** → deve cair em `/admin`.
4. `/admin` — confira os 2 cards clicáveis ("Usuários", "Drive e sincronização") e a caixa pontilhada "em breve" do dashboard (sem nenhum número, só o texto).
5. Clique no card "Usuários" → confira o breadcrumb no topo (Painel do Gestor / Usuários) e a tabela com badges coloridos de status.
6. Abra um usuário → confira as seções (progresso, editar dados, redefinir senha, módulos por fase com "Ver tentativas da prova").
7. Volte para `/admin` → clique em "Drive e sincronização" → "Analisar alterações" → confira que a estrutura lida do Drive e o diff aparecem com os badges YouTube/PDF/avisos.
8. Saia (botão "Sair" no header) e logue como **student** → deve cair em `/app`.
9. `/app` — confira a barra de progresso geral, os accordions de fase (percentual à direita), e que o módulo atual tem destaque verde-claro com "continuar".
10. Abra um módulo liberado → confira breadcrumb, leitor de PDF (ou player de YouTube) com fundo branco, botões "Anterior/Próxima" grandes, e a área de quiz abaixo.

## Mobile (largura ~375px — pode usar o modo responsivo do navegador)

1. Repita os passos 2-4 do desktop, prestando atenção a:
   - Login: card não deve ficar colado nas bordas da tela.
   - `/admin`: os 2 cards devem empilhar em coluna única (grid responsivo).
2. `/admin/usuarios` — a tabela deve ter scroll horizontal próprio (não empurrar a página inteira para o lado); os filtros (busca/trilha/status) devem quebrar linha em vez de vazar da tela.
3. `/app` — accordions devem ocupar a largura toda; toque em um módulo liberado deve ter uma área confortável (não precisar acertar um alvo pequeno).
4. Página do módulo:
   - PDF: o leitor deve ajustar a largura da página automaticamente; os botões "Anterior/Próxima" devem ser fáceis de tocar com o dedo.
   - YouTube: o player deve manter a proporção 16:9 sem cortar nem sobrar faixas pretas excessivas.
   - Quiz: as alternativas (rádio) devem ter espaçamento suficiente para não tocar a errada por engano.
5. Navegue pelo teclado (se estiver testando num notebook/tablet com teclado): confirme que dá para tabular entre os campos do login e que o contorno verde de foco aparece em botões/links.

## Conferência final (qualquer tamanho de tela)

- Nenhuma tela deve mais mostrar fundo escuro — tudo deve estar no tema claro.
- Nenhuma tela deve mostrar textos de diagnóstico tipo "Fase X concluída" ou menção ao `EXECUTION_PLAN.md`.
- O logo da Shopper deve aparecer em todo header (topo de toda página autenticada) e na tela de login.
- Todas as funcionalidades que já existiam (busca, filtros, editar usuário, redefinir senha, sincronizar Drive, responder quiz, assistir vídeo, baixar PDF) devem continuar funcionando exatamente como antes — só a aparência mudou.
