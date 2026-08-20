# Roteiro de teste — patch corretivo (PDF, breadcrumb, YouTube iOS)

## 0. Antes de testar

Aplique o patch, `npm install`, `npm run build` local, `git add . && git commit && git push`.

## 1. PDF vertical (Word) — desktop, modo normal

1. Abra um módulo com PDF vertical/Word, sem ampliar.
2. A página deve usar bem a largura disponível e ser legível — **sem** margem branca excessiva em volta. Compare com como estava antes do Modo de Estudo existir: deve parecer igual.
3. "Página X de Y" e os botões "Anterior"/"Próxima" devem aparecer normalmente abaixo da página.
4. O botão "⛶ Ampliar" deve aparecer no canto, discreto, sem interferir na leitura.

## 2. PDF vertical (Word) — iPhone, modo normal

1. Mesmo módulo, no Safari do iPhone, sem ampliar.
2. A página deve ocupar bem a largura da tela, texto legível sem precisar de zoom manual.
3. Confirme que não há uma faixa branca grande acima/abaixo da página.

## 3. PDF vertical (Word) — Modo de Estudo ampliado

1. Toque em "⛶ Ampliar".
2. A página deve crescer para usar o máximo de largura **e** altura disponíveis, centralizada, sem uma margem vazia grande acima.
3. Teste as setas ‹ › sobrepostas e o swipe (arrastar o dedo) para trocar de página.
4. Toque no `X` — deve voltar ao módulo normal, na mesma página em que estava.

## 4. PDF horizontal (PowerPoint) — Modo de Estudo, portrait → landscape

1. No celular, em pé (portrait), abra um módulo de PowerPoint e toque em "Ampliar".
2. Confirme que já ficou bom (como você validou antes).
3. **Gire o celular para paisagem, com o modo ampliado já aberto** (não feche antes de girar).
4. A página deve se reajustar automaticamente para usar a tela inteira na nova orientação, **sem precisar fechar e reabrir o Modo de Estudo**.
5. As setas ‹ › e o `X` devem continuar funcionando normalmente depois de girar.
6. Gire de volta para portrait e confirme que reajusta de novo, sem travar.

## 5. Breadcrumb — voltar por "Minha Trilha"

1. Abra qualquer módulo liberado.
2. Confirme visualmente que "Minha Trilha" no breadcrumb aparece com cor de link (verde escuro) e, ao passar o mouse (desktop), fica sublinhado.
3. Clique/toque em "Minha Trilha" — deve voltar para `/app` normalmente.
4. Repita em pelo menos uma tela administrativa (ex: `/admin/usuarios/[id]` → clique em "Usuários" no breadcrumb) para confirmar que a correção vale para todos os breadcrumbs, não só o do módulo.
5. **Se "Minha Trilha" ainda não navegar depois deste patch**, por favor me avise com um print exato do que acontece (a tela antes e depois do clique) — a lógica está auditada e correta por inspeção de código, então se persistir, preciso investigar algo mais específico do seu ambiente (ex: cache do navegador de uma versão anterior).

## 6. YouTube — desktop

1. Abra um módulo de vídeo em qualquer navegador desktop.
2. Deve continuar funcionando exatamente como antes (isso já funcionava e não deveria ter mudado).

## 7. YouTube — Safari/iPhone, modo normal (o bug principal)

1. Abra um módulo de vídeo no Safari do iPhone, **sem ampliar**.
2. O vídeo deve carregar e tocar normalmente — este é o teste mais importante do patch.
3. Se ainda aparecer preto: abra o Console remoto do Safari (via Mac, com o iPhone conectado e o modo desenvolvedor ativado) e veja se aparece a mensagem `YouTube player onError` no console — me mande o código numérico que aparecer, isso aponta exatamente a causa (ex: 101/150 = o vídeo específico tem embed bloqueado pelo dono, não é mais um problema geral do player).

## 8. YouTube — Safari/iPhone, Modo de Estudo ampliado

1. No mesmo vídeo do passo 7, dê play, espere alguns segundos, toque em "Ampliar".
2. O vídeo deve continuar tocando do mesmo ponto, sem reiniciar, dentro do modo ampliado.
3. Toque no `X` para fechar — o vídeo deve continuar de onde estava, sem reiniciar.

## 9. Percentual assistido continua sendo registrado

1. Em qualquer um dos testes de vídeo acima (desktop ou iPhone), assista por pelo menos 10-15 segundos.
2. Confirme visualmente que a barra de percentual assistido avança.
3. Recarregue a página do módulo e confirme que o percentual não voltou a zero (ele nunca regride).
4. Assista até passar de 90% e confirme que "Concluir módulo" (sem quiz) ou a liberação do quiz (com quiz) continuam funcionando exatamente como antes — nenhuma regra de progressão foi tocada neste patch.
