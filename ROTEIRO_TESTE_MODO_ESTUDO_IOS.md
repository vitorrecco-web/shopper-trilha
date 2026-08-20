# Roteiro de teste — YouTube no iOS + Modo de Estudo

## 0. Antes de testar

Aplique o patch, `npm install`, `npm run build` local pra confirmar, `git add . && git commit && git push`.

## 1. YouTube no iPhone (o bug original)

1. No iPhone, no **Safari** (não em outro navegador — o bug era específico do WebKit), abra um módulo de vídeo liberado.
2. O player deve renderizar o vídeo normalmente — sem retângulo preto.
3. Dê play, deixe rodar uns 10-15s, pause.
4. Recarregue a página e confirme que o percentual assistido não caiu (mesma regra de sempre, nada mudou aqui).
5. Repita em **Chrome no Android** — deve continuar funcionando como já funcionava.
6. Repita em **desktop** (qualquer navegador) — deve continuar exatamente igual a antes.

## 2. Modo de Estudo — PDF, no mobile

1. Abra um módulo de PDF liberado.
2. Toque no botão discreto "⛶ Ampliar" no canto do material.
3. Confirme que a página ocupa quase a tela inteira, com fundo escurecido atrás.
4. Toque na seta `›` (direita) — deve ir para a próxima página. Confirme que "Página X de Y" aparece discretamente na parte inferior.
5. Deslize o dedo da direita para a esquerda (swipe) — deve avançar página também.
6. Deslize a página até a última — confirme que a seta `›` some/fica sem função (não só cinza — deve desaparecer).
7. Volte até a primeira página — confirme que a seta `‹` some.
8. Toque no `X` no canto superior direito — deve voltar ao módulo normal, **na mesma página em que você estava**.

## 3. Modo de Estudo — PDF, no desktop

1. Repita os passos acima com mouse/teclado.
2. Clique fora do X para confirmar que nada fecha por engano (só o X ou ESC fecham).
3. Pressione **ESC** — deve fechar e voltar à página normal, mantendo a página do PDF.
4. Confirme que o fundo da página (o resto do site) fica visível atrás, escurecido, e **não rola** enquanto o modo está aberto.
5. Use Tab pelo teclado — o foco deve começar no botão de fechar ao abrir o modo.

## 4. Modo de Estudo — Vídeo

1. Abra um módulo de vídeo, dê play, deixe rodar ~5 segundos.
2. Toque/clique em "⛶ Ampliar".
3. Confirme que o vídeo **continua tocando do mesmo ponto** (não reinicia) e continua reportando progresso normalmente (a barra de percentual assistido deve continuar subindo).
4. Feche o modo ampliado (X ou ESC) — o vídeo deve continuar tocando exatamente de onde estava, sem reiniciar.
5. Confirme que assistir o suficiente (90%) e concluir o módulo funciona igual a antes, tanto dentro quanto fora do modo ampliado.

## 5. Conferência final

- Nenhuma regra de conclusão, quiz, progressão ou threshold de 90% deve ter mudado — só a apresentação/interação.
- O botão "Baixar PDF" e o restante da página do módulo continuam exatamente como estavam antes deste patch.
