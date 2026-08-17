# Shopper Trilha — PROJECT_CONTEXT

## 1. Objetivo do produto
Construir uma plataforma online responsiva, com prioridade para uso em celular, para capacitação de colaboradores em desenvolvimento para a função de supervisor. A plataforma deve escalar para diferentes galpões, turnos e funções, mantendo conteúdo centralizado no Google Drive e histórico individual de progresso em banco de dados.

## 2. Perfis de acesso
- `admin`: único perfil administrativo da V1.
- `student`: aluno/supervisor em treinamento.

Não haverá perfis intermediários na V1.

## 3. Estrutura pedagógica
Hierarquia:

`Trilha de Liderança -> Fases -> Módulos -> PDF -> Perguntas opcionais`

A trilha é sequencial.

### 3.1 Fase 1
A Fase 1 é específica da função. A função do usuário determina qual pasta será carregada dentro da Fase 1.

Exemplos de trilha/função:
- Supervisor de Picking
- Supervisor de Packing
- Supervisor de Recebimento
- Supervisor de Reposição

Essas opções devem ser derivadas das pastas existentes no Drive após sincronização.

### 3.2 Fases seguintes
Fase 2 em diante são comuns a todos os usuários.

### 3.3 Progressão
Fluxo com perguntas:

`Acessar PDF -> liberar perguntas -> responder -> >=70% -> concluir módulo -> liberar próximo módulo`

Fluxo sem perguntas:

`Acessar PDF -> concluir módulo -> liberar próximo módulo`

Ao concluir o último módulo de uma fase, o primeiro módulo da fase seguinte é liberado automaticamente.

## 4. Regras de avaliação
- `perguntas.json` é opcional.
- Se existir, todas as perguntas são mostradas em cada tentativa.
- Cada pergunta possui exatamente 4 alternativas.
- Perguntas são embaralhadas a cada tentativa.
- Alternativas são embaralhadas a cada tentativa.
- A alternativa correta é vinculada por ID interno, nunca pela posição visual.
- Nota mínima: `70%`.
- Tentativas: ilimitadas e imediatas.
- Após envio, mostrar nota, acertos/erros e explicação quando houver.
- Explicação é opcional.
- Após aprovação, o módulo fica permanentemente concluído.
- Novas tentativas continuam permitidas após conclusão.
- Nota menor posterior não remove conclusão.
- Guardar melhor nota e histórico completo das tentativas.

## 5. Estrutura do Google Drive
O Google Drive é a fonte de verdade do conteúdo e da estrutura pedagógica.

Estrutura esperada:

```text
Trilha de Liderança/
├── Fase 1 - <assunto da fase>/
│   ├── Supervisor de Picking/
│   │   ├── Módulo 1/
│   │   │   ├── <nome do conteúdo>.pdf
│   │   │   └── perguntas.json   # opcional
│   │   ├── Módulo 2/
│   │   └── ...
│   ├── Supervisor de Packing/
│   ├── Supervisor de Recebimento/
│   └── Supervisor de Reposição/
├── Fase 2 - <assunto da fase>/
│   ├── Módulo 1/
│   │   ├── <nome do conteúdo>.pdf
│   │   └── perguntas.json       # opcional
│   └── ...
├── Fase 3 - <assunto da fase>/
└── ...
```

### 5.1 Convenções
- Cada módulo deve conter exatamente 1 PDF.
- O PDF pode ter nome descritivo; não precisa se chamar `material.pdf`.
- O nome do PDF será o título/descrição exibido ao usuário, sem a extensão `.pdf`.
- O nome da pasta do módulo define o número/ordem do módulo.
- O nome da pasta da fase define número/ordem e título da fase.
- O arquivo de perguntas deve se chamar exatamente `perguntas.json`.

## 6. Identidade permanente de conteúdo
Não usar nome de pasta como identidade técnica.

- `drive_folder_id` da pasta da fase = identidade permanente da fase.
- `drive_folder_id` da pasta do módulo = identidade permanente do módulo.
- `drive_folder_id` da pasta da função = identidade permanente da trilha/função da Fase 1.

Renomear/reordenar uma pasta existente preserva histórico porque o ID do Drive permanece o mesmo.

Excluir uma pasta e criar outra com nome semelhante representa conteúdo novo.

## 7. Alterações futuras na trilha
### 7.1 Novo módulo ou nova fase
- Torna-se obrigatório para todos os usuários ativos daquela trilha.
- Não apagar conclusões antigas.
- Não bloquear novamente módulos que já tinham sido desbloqueados.
- O novo conteúdo entra como pendência para voltar a 100%.

### 7.2 Remoção
- Conteúdo removido deixa de aparecer para alunos.
- Deixa de contar no progresso atual.
- Histórico existente deve permanecer no banco.
- Usar `active = false`, não exclusão física.

### 7.3 Reordenação / renomeação
- Preservar histórico usando o ID do Drive.
- Se uma fase 3 virar fase 4, apenas atualizar nome/ordem.
- Mesma regra para módulos.

## 8. Sincronização com Drive
A sincronização é manual.

Fluxo:

`Admin -> Sincronizar com Drive -> Analisar -> Mostrar prévia -> Confirmar -> Aplicar alterações`

A prévia deve mostrar:
- novos
- removidos
- renomeados
- reordenados
- atualizados
- avisos

Também mostrar data/hora da última sincronização.

### 8.1 Arquivo de perguntas inválido
Se `perguntas.json` existir, validar antes de uso.

Se for inválido:
- mostrar aviso na prévia;
- não quebrar o módulo;
- publicar o módulo como se estivesse sem perguntas até o JSON ser corrigido.

## 9. Material PDF
- PDFs ficam em Drive privado.
- Supervisor não recebe acesso à pasta do Drive.
- PDF deve ser servido pela aplicação após autorização.
- O PDF abre em visualizador dentro da Shopper Trilha.
- Também existe botão `Baixar PDF`.
- Primeiro acesso ao visualizador registra `material_accessed = true` e data/hora.
- Não tentar medir tempo de leitura.

## 10. Interface do aluno
### 10.1 Home / Minha Trilha
- Responsiva, mobile-first.
- Progresso geral no topo.
- Fases em accordion abre/fecha.
- A fase do próximo conteúdo pendente abre por padrão.
- Percentual aparece na fase, não no módulo.
- Módulos bloqueados continuam mostrando nome/título.
- Módulo concluído mostra check.
- Módulo atual/liberado tem destaque visual.
- Módulo bloqueado mostra cadeado.
- Novo conteúdo obrigatório inserido pode receber destaque `Novo`.

### 10.2 Percentuais
Percentual da fase:

`módulos ativos concluídos na fase / total de módulos ativos aplicáveis da fase`

Percentual geral:

`módulos ativos concluídos / total de módulos ativos aplicáveis ao usuário`

Não armazenar percentuais prontos no banco.

### 10.3 Página do módulo
Ao tocar em módulo liberado, abrir página própria.

Elementos:
- voltar para Minha Trilha;
- fase/módulo;
- título do PDF;
- visualizador PDF;
- botão Baixar PDF;
- perguntas, se existirem e já tiver material acessado;
- resultado da tentativa;
- botão `Ir para o próximo módulo` após aprovação.

Não avançar automaticamente após aprovação.

## 11. Usuários
### 11.1 Cadastro pelo admin
Campos:
- nome completo
- matrícula
- login
- senha
- trilha/função
- CD/Galpão
- turno
- status

### 11.2 Regras
- `login` deve ser único, case-insensitive.
- `matricula` pode repetir em outro cadastro/trilha.
- senha é definida pelo admin.
- não há troca obrigatória no primeiro acesso.
- não há recuperação por e-mail na V1.
- admin pode redefinir senha.
- senha nunca é armazenada em texto puro; somente hash.

### 11.3 Mudança de função
Função/trilha não pode ser alterada em um cadastro existente.

Se o colaborador mudar de Picking para Packing:
- criar novo usuário/login;
- mesma matrícula pode ser usada;
- progresso começa zerado;
- cadastro antigo fica como histórico.

### 11.4 Campos editáveis
Podem ser alterados:
- nome
- CD/Galpão
- turno
- login
- senha
- status

A trilha/função não deve ser editada após criação.

## 12. Inativação e conclusão
- Não excluir usuário pela interface na V1.
- Admin pode ativar/inativar.
- Inativo não consegue fazer login.
- Histórico permanece intacto.
- Ao reativar, continua de onde parou.
- Usuário em 100% continua com acesso.
- Pode revisar PDFs e refazer perguntas.
- A situação `Concluída` é calculada, não salva como flag permanente.

## 13. Painel administrativo
Tela principal em tabela.

Colunas sugeridas:
- Nome
- Matrícula
- Trilha
- CD
- Turno
- Progresso
- Status
- Último acesso

Ações principais:
- Novo usuário
- Editar usuário
- Redefinir senha
- Ativar/Inativar
- Ver detalhes
- Sincronizar com Drive

Detalhe do usuário deve permitir consultar:
- data de início
- último acesso
- módulos
- material acessado
- data do acesso
- módulos concluídos
- data de conclusão
- tentativas
- notas
- melhor nota
- progresso atual

## 14. Arquitetura recomendada para V1
- Framework: Next.js
- Hospedagem: Vercel
- Banco: PostgreSQL via Supabase
- Autenticação: própria aplicação com login + senha hash
- Conteúdo: Google Drive privado
- Integração Drive: Google Drive API somente no servidor
- PDF: servidor da aplicação intermedeia acesso

Nunca expor credenciais do Drive ou segredos no frontend.

## 15. Tabelas da V1
- `users`
- `tracks`
- `phases`
- `modules`
- `user_modules`
- `quiz_attempts`
- `sync_history`
- `sync_changes`

## 16. Regras de cálculo
### 16.1 Módulo atual
Não salvar `current_module`.

Calcular como o primeiro módulo obrigatório ainda não concluído, respeitando:
- módulos ativos;
- módulos aplicáveis à trilha do usuário;
- módulos já desbloqueados continuam acessíveis mesmo se novo conteúdo for inserido antes deles.

### 16.2 Status da trilha
Não salvar `trilha_concluida`.

- 100% = concluída
- abaixo de 100% = em andamento
- `users.status = inactive` = acesso inativo

## 17. Fora do escopo da V1
Não implementar agora:
- prova final online
- certificado
- login Google
- recuperação de senha por e-mail
- múltiplos níveis administrativos
- notificações
- ranking/gamificação
- gráficos avançados
- app nativo Android/iOS
- edição de fases/módulos pela plataforma
- sincronização automática com Drive

## 18. Diretriz para desenvolvimento com Claude
Claude não deve redefinir regras de produto ou arquitetura.

Sempre:
1. Ler este arquivo antes de alterar código.
2. Executar apenas a tarefa solicitada.
3. Não modificar funcionalidades fora do escopo da tarefa.
4. Não substituir Drive por conteúdo hardcoded.
5. Não gerar perguntas automaticamente.
6. Não simplificar removendo histórico, IDs do Drive ou regras de progressão.
7. Priorizar mobile-first e responsividade.
8. Preservar compatibilidade com módulos novos, removidos, renomeados e reordenados.
