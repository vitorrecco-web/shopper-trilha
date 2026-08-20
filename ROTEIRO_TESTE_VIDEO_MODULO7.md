# Roteiro de teste em produção — módulo de vídeo (Módulo 7)

Usa o caso real já criado no Drive: `Fase 3 - Desenvolvimento de liderança / Módulo 7 / video.json` (vídeo "Children See Children Do").

## 0. Pré-requisito

Aplique a migration `0003_video_module_support.sql` no Supabase (SQL Editor, ou `supabase db push`) **antes** de aplicar o patch de código.

## 1. Sincronizar

1. `/admin/drive` → **Analisar alterações**.
2. Na "Estrutura lida do Drive", confira que o Módulo 7 aparece marcado como **YouTube** (não PDF).
3. Se o Módulo 7 for novo (primeira sincronização depois deste patch), ele deve aparecer em "Mudanças detectadas" como **Novo**. Se você já tinha outro conteúdo nesse módulo antes, deve aparecer como **Atualizado** (`material principal mudou de PDF para YouTube` ou similar).
4. Confira a lista de **Avisos** — não deve haver nenhum aviso sobre o Módulo 7 (se aparecer "video.json inválido", revise o arquivo no Drive).
5. **Confirmar e sincronizar**.
6. Confira no Supabase (`table modules`, filtrando pelo Módulo 7): `material_type = 'youtube'`, `video_external_id = 'jOrGsB4qG_w'`, `video_titulo = 'Children See Children Do'`, `pdf_drive_id` deve estar `null`.

## 2. Ver o vídeo como aluno

1. Logue com um usuário cuja trilha passa pela Fase 3 (ou crie um de teste).
2. Em `/app`, avance até o Módulo 7 estar liberado e abra-o.
3. Confirme:
   - O player do YouTube aparece embutido, responsivo, sem sair da página.
   - O título complementar ("Children See Children Do") aparece abaixo do player.
   - Uma barra de progresso aparece, começando em 0%.

## 3. Testar o gate de conclusão (sem quiz, supondo que o Módulo 7 não tenha `perguntas.json`)

1. Dê play e assista só uma parte pequena do vídeo (ex: 20-30%).
2. Confirme que o botão **"Concluir módulo"** aparece **desabilitado**, com o texto "Assista pelo menos 90% do vídeo...".
3. Avance o vídeo (pode arrastar a barra de progresso do próprio player do YouTube) até passar de 90%.
4. Confirme que o botão fica habilitado automaticamente (sem precisar recarregar a página) e que a barra de progresso muda de cor.
5. Clique em **"Concluir módulo"**.
6. Confirme que aparece "✓ Módulo concluído" e o link para o próximo módulo.
7. Volte para `/app` e confirme que o próximo módulo da sequência está liberado.

## 4. Confirmar que o percentual nunca regride

1. Volte a abrir o Módulo 7 (já concluído).
2. Arraste o vídeo de volta para o início e dê play por alguns segundos.
3. Confirme no Supabase (`user_modules.video_watched_percent`, sua linha + o Módulo 7) que o valor **não caiu** abaixo do que já tinha atingido antes.

## 5. Testar via chamada direta (bypass da UI)

Confirma que o servidor recusa concluir sem o percentual mínimo, mesmo chamando a API direto:

```bash
curl -X POST https://SEU-APP.vercel.app/api/modulos/ID_DO_MODULO_7/complete-video \
  -H "Cookie: shopper_trilha_session=SEU_COOKIE_DE_SESSAO"
```

Com um usuário que nunca reportou progresso nesse módulo, deve voltar `403` com `"Assista pelo menos o percentual mínimo do vídeo antes de concluir."`.

## 6. Se o Módulo 7 tiver `perguntas.json` (quiz)

1. Assista menos de 90% do vídeo e tente abrir o quiz — deve continuar bloqueado (mesma mensagem de "acesse o material" que já existia, mais a exigência de percentual).
2. Passe de 90% e confirme que o quiz libera.
3. Responda e confirme que a aprovação libera o próximo módulo — igual ao fluxo de quiz já existente, sem nenhuma mudança de comportamento.

## 7. Testar o conflito PDF + `video.json` (opcional, cenário de erro)

1. No Drive, dentro de qualquer pasta de módulo, coloque **um PDF e um `video.json` juntos**.
2. Rode "Analisar alterações" em `/admin/drive`.
3. Confirme que aparece um aviso de conflito ("encontrado PDF e video.json juntos...") e que a estrutura lida mostra esse módulo como **PDF** (não YouTube) — o sistema não deve escolher silenciosamente nem quebrar.
4. Remova um dos dois arquivos e sincronize de novo para resolver.
