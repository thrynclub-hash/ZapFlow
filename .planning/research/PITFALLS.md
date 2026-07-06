# ZapFlow Fase 2 — Pitfalls Research

> **Escopo:** Pitfalls NOVOS específicos das 4 features da Fase 2. Não repete o que já está documentado em `.planning/codebase/CONCERNS.md` (zero testes automatizados, triggers polling, LGPD, webhook secret off by default) — esses continuam valendo como pano de fundo de risco, mas não são repetidos item a item aqui.
>
> **Contexto real do codebase (grounding):** `contacts.status` hoje é Ativo/Inativo, setado manualmente, e já é lido pelo motor de envio (`run-automations`). `contacts.tags` é `text[]` livre (ex: "Novo"/"Antigo"). `mp-webhook` hoje só trata add-ons (número recorrente via `preapproval`, contatos avulso via `payment`) — NÃO trata ainda a assinatura do plano principal, que hoje é 100% manual (`clients.plan_next_charge_at`, calculado no frontend, sem cobrança automática). `plan_limits` existe com `contacts_limit`/`numbers_limit` mas hoje SEM enforcement real (nada bloqueia). Webhook secret é opcional e OFF por padrão nos dois webhooks existentes (Z-API e MP) — isso se estende automaticamente a qualquer novo webhook de billing na Fase 2 se copiar o padrão atual sem revisão.

---

## 1. Contact Status Lifecycle com Transições Automáticas

### P1.1 — Cálculo de "N dias sem interação" com timezone errado
**O que dá errado:** Comparar `now()` (UTC no Postgres) contra `last_interaction_at` sem considerar que "dia" para o dono da clínica é fuso de Brasília (UTC-3). Um contato que interagiu às 22h horário local pode ser contado como "já se passou 1 dia" horas antes do esperado, ou o cron que roda a transição à meia-noite UTC (21h Brasília) pode disparar a virada de status num horário estranho do dia local, confundindo quem está olhando o dashboard em tempo real.
**Aplica-se a:** contact status lifecycle.
**Como detectar cedo:** escrever o teste de unidade do cálculo de dias com um timestamp fixo perto da virada de dia (23h59 e 00h01 horário de Brasília) e verificar se o resultado é o esperado nos dois lados.
**Como prevenir:** definir explicitamente "dia" como dia civil em `America/Sao_Paulo`, não em UTC corrido. Fazer o cron/job rodar em horário de baixo tráfego local (ex: 4h da manhã Brasília) em vez de meia-noite UTC. Documentar no código qual é a convenção de "dia" usada, porque isso vai voltar a ser perguntado.

### P1.2 — Import em massa dispara transição de status pra todo mundo de uma vez
**O que dá errado:** Se a lógica de transição roda em cada `UPDATE`/`INSERT` de contato (trigger de banco) ou olha só "quando foi a última vez que o contato apareceu no sistema" em vez de "quando foi a última interação humana real", um import de CSV (feature 4 desta mesma fase) ou uma correção em massa de dados pode fazer centenas de contatos mudarem de status ao mesmo tempo — inclusive contatos que estavam "Dormindo" corretamente virarem "Ativo" só porque a linha do banco foi tocada, ou o oposto.
**Aplica-se a:** contact status lifecycle + CSV import (interação direta entre as duas features).
**Como detectar cedo:** rodar o import de teste (mesmo com poucas linhas) num ambiente de staging com contatos que já têm status variados e conferir se o status deles muda sem motivo depois do import.
**Como prevenir:** a transição automática deve depender exclusivamente de um campo de "última interação real" (mensagem enviada/recebida, clique) e nunca de `updated_at` genérico da linha. Import de CSV deve popular `created_at`/tag de origem sem tocar em `last_interaction_at` nem em `status` de contatos existentes (só define status inicial para contatos novos). Rodar o job de transição como processo separado e idempotente, não como side-effect de outro fluxo.

### P1.3 — Status muda no meio do envio de uma campanha e é lido de forma inconsistente
**O que dá errado:** O motor de disparo (`run-automations`) monta a lista de destinatários (ex: "todos Ativos com tag X") no início do processamento, mas o job de transição automática de status roda em paralelo (cron separado) e muda o status de alguns contatos de "Ativo" pra "Dormindo" a meio caminho do envio. Resultado: parte do batch é decidida com o status de antes, parte com o de depois — inconsistência silenciosa, difícil de reproduzir e impossível de auditar depois (ninguém sabe que status o contato tinha no momento exato do envio).
**Aplica-se a:** contact status lifecycle + campanhas/automações existentes.
**Como detectar cedo:** revisar se o job de transição de status e o cron de disparo de campanha podem se sobrepor no mesmo horário (ambos rodando de hora em hora, por exemplo) — se sim, o cenário é real, não hipotético.
**Como prevenir:** (a) snapshot do status do contato no momento em que ele é adicionado a um `message_log`/fila de envio, gravado junto com o log (não recalculado depois); (b) ou serializar os dois jobs (nunca rodar transição de status enquanto uma campanha está em `status='sending'`); (c) no mínimo, logar no `message_logs` qual era o status do contato no momento do envio, para permitir auditoria retroativa mesmo que a race condition não seja 100% eliminada.

### P1.4 — Transição "silenciosa" sem rastro nem notificação
**O que dá errado:** Contato vira "Dormindo" automaticamente e ninguém no time da clínica percebe — campanhas com `target_tags`/filtro por status param de alcançar essas pessoas sem aviso, e o dono acha que a base "encolheu" sem entender por quê.
**Aplica-se a:** contact status lifecycle.
**Como detectar cedo:** perguntar ao usuário beta (Hassum) se ele esperaria ser avisado quando um contato muda de status automaticamente.
**Como prevenir:** manter um log de auditoria simples (`status_history` ou similar: contato, status_anterior, status_novo, motivo, timestamp) — não precisa de notificação em tempo real na v1, mas precisa ser possível responder "por que esse contato está Dormindo?" sem adivinhar.

---

## 2. Dashboard de Consumo de Plano (Uso vs Limite)

### P2.1 — Off-by-one na comparação com o limite
**O que dá errado:** `plan_limits.contacts_limit = 1000` mas a checagem usa `>` em vez de `>=` (ou vice-versa) num dos dois lugares (frontend mostra "999/1000, ok" enquanto o backend já bloqueia na tentativa de criar o contato 1000, ou o contrário — deixa criar o 1001º). Como cada plano tem um limite hardcoded diferente (1000/2000/5000/null), um erro de operador binário é fácil de escapar no teste manual com números redondos e só aparecer quando o cliente está exatamente na borda.
**Aplica-se a:** dashboard de consumo.
**Como detectar cedo:** teste explícito com contagem = limite exato (não só "muito abaixo" e "muito acima").
**Como prevenir:** centralizar a comparação limite em UM lugar (idealmente uma função/view no banco, não duplicada em frontend e edge function), e tratar `contacts_limit = null` (Enterprise, ilimitado) como caso explícito — não como `Infinity` implícito que pode quebrar se alguém trocar o tipo da coluna.

### P2.2 — Dashboard mostra contagem cacheada/desatualizada
**O que dá errado:** Se a contagem de contatos usados vem de um campo persistido (ex: `clients.contacts_count`) atualizado só em alguns pontos do código (ex: só no fluxo manual de "adicionar contato", esquecendo o fluxo de import CSV da feature 4 desta mesma fase), o dashboard mostra número desatualizado — cliente vê "800/1000" mas na verdade já importou 1200 via CSV, porque o import não incrementou o contador.
**Aplica-se a:** dashboard de consumo + CSV import (mesma armadilha do P1.2: feature nova que esquece de atualizar contador central).
**Como detectar cedo:** depois de implementar o import CSV, verificar se o dashboard reflete a mudança sem precisar de refresh manual do cache/contador.
**Como prevenir:** preferir `count(*)` calculado on-the-fly (com índice adequado) a um contador desnormalizado, a menos que a tabela de contatos já seja grande o suficiente para justificar cache — e se cachear, invalidar o cache em TODOS os pontos de entrada de contato (manual, import CSV, futura integração), não só no principal.

### P2.3 — Não existe período de graça para "acima do limite mas já pagou o ciclo"
**O que dá errado:** Cliente está no plano Growth (2000 contatos), sobe pra 2100 no meio do mês (ex: importou uma lista do LinkedIn), e o sistema bloqueia a criação de novos contatos ou pior, bloqueia envio de campanha pro contato 2001+ — mesmo o cliente já tendo pago o ciclo corrente. Isso é agravado porque hoje (`supabase_plan_billing.sql`) o pagamento do plano principal é manual/fora do sistema — não há "upgrade automático" fácil no meio do ciclo, então um bloqueio duro no exato momento em que o limite é excedido pode travar a operação da clínica sem alternativa imediata.
**Aplica-se a:** dashboard de consumo + billing sync (interseção das duas features).
**Como detectar cedo:** perguntar explicitamente na fase de planejamento: "o que acontece no primeiro contato acima do limite — bloqueia na hora, avisa e libera com grace period, ou só bloqueia campanhas novas mas deixa contatos existentes continuarem recebendo mensagens?"
**Como prevenir:** decidir e documentar a política antes de implementar (sugestão: soft-block — dashboard mostra vermelho e alerta o admin/Leonardo, mas não interrompe envios em andamento; hard-block só em criação de contato novo acima do limite, nunca em campanha já agendada). Não acoplar a lógica de "limite estourado" a um bloqueio automático de billing, já que a fatura do plano principal ainda é gerida manualmente.

---

## 3. Sincronização de Status de Assinatura via Webhook do Mercado Pago

### P3.1 — Falta de idempotência: mesmo evento processado duas vezes
**O que dá errado:** Mercado Pago pode reenviar a mesma notificação de webhook (retry automático deles se a resposta demorar ou não vier 200 rápido o suficiente). O `mp-webhook` atual faz um `UPDATE ... SET status = X` — que por si só é idempotente para o campo de status simples, mas se a Fase 2 adicionar efeitos colaterais não-idempotentes no mesmo fluxo (ex: "enviar email de boas-vindas quando vira active", "creditar N dias de acesso extra", "logar evento de billing para métricas"), processar o mesmo webhook duas vezes duplica esses efeitos.
**Aplica-se a:** billing status sync.
**Como detectar cedo:** simular o mesmo payload de webhook chegando duas vezes seguidas em ambiente de teste e verificar se algum efeito colateral (não o simples `UPDATE` de status) é duplicado.
**Como prevenir:** gravar o `id` do evento/notificação do Mercado Pago (não o `data.id` do preapproval/payment, mas o identificador único da notificação, se disponível) numa tabela de eventos processados, e checar antes de aplicar qualquer efeito colateral não-idempotente. No mínimo, qualquer novo side-effect deve ser desenhado para ser seguro rodar 2x (ex: `INSERT ... ON CONFLICT DO NOTHING`, não `INSERT` simples).

### P3.2 — Webhooks chegando fora de ordem
**O que dá errado:** Mercado Pago não garante ordem de entrega. Uma sequência real "assinatura autorizada → depois cancelada" pode chegar ao servidor como "cancelada → depois autorizada" (por latência de rede, retry, etc.), fazendo o `mp-webhook` sobrescrever `status='cancelled'` de volta para `'active'` mesmo que a cancelação seja o evento mais recente de verdade.
**Aplica-se a:** billing status sync.
**Como detectar cedo:** revisar se o handler atual usa APENAS o `status` que veio na notificação, sem comparar timestamp/versão do evento — hoje ele faz exatamente isso (`mp-webhook/index.ts:95-104` seta `newStatus` direto do resultado da consulta à API do MP, sem checar se é mais recente que o estado atual).
**Como prevenir:** o handler já busca o estado atual direto na API do Mercado Pago (não confia no corpo da notificação — isso é bom e já mitiga falsificação), mas ainda assim deveria gravar/comparar um timestamp de "última atualização de status" no banco (`updated_at` do preapproval/payment vindo da resposta da API do MP) e só sobrescrever se o evento consultado for mais recente que o que já está salvo. Isso resolve tanto fora-de-ordem quanto duplo processamento parcial.

### P3.3 — Sem validação de assinatura (signature) real, só token opcional na URL
**O que dá errado:** O Mercado Pago suporta validação de assinatura HMAC (`x-signature` header) nas notificações — o `mp-webhook` atual não valida isso, só tem um token opcional na query string que está OFF por padrão (já documentado em CONCERNS.md 4.2, mas vale reforçar aqui porque billing é o alvo de maior risco financeiro/reputacional de falsificação: alguém forjar uma notificação de "pagamento aprovado" sem nunca ter pago).
**Aplica-se a:** billing status sync.
**Nuance específica de billing (diferente do risco genérico já em CONCERNS.md):** o código já mitiga parcialmente isso ao NUNCA confiar no corpo da notificação para decidir o status — sempre revalida direto na API do MP com o token do servidor antes de aplicar qualquer mudança (`mp-webhook/index.ts:79-90`). Isso reduz bastante o risco de "forjar pagamento aprovado do nada", porque o atacante precisaria saber um ID de pagamento/assinatura real e legítimo. Mas não elimina o risco de um atacante disparar RECONSULTAS em massa (custo de API/rate limit do MP) ou re-triggerar side-effects não-idempotentes (ver P3.1) usando IDs de pagamentos antigos e válidos que ele descobriu por algum vazamento.
**Como prevenir:** ativar `MP_WEBHOOK_SECRET` antes de expandir o webhook pra tratar a assinatura do plano principal (não só add-ons) — o risco financeiro sobe quando o webhook passa a controlar acesso/bloqueio de conta inteira, não só um add-on. Considerar migrar para validação de assinatura HMAC oficial do Mercado Pago (`x-signature` + `x-request-id`) em vez do token simples na query string.

### P3.4 — Usuário logado no meio da sessão quando status vira "Em atraso"/"Cancelada"
**O que dá errado:** Se o frontend só checa o status de billing no login (ex: guarda em contexto/estado local e nunca revalida), um cliente pode continuar usando a aplicação normalmente por horas depois que a assinatura já foi marcada como atrasada/cancelada no backend — ou pior, o oposto: sessão é interrompida abruptamente no meio do preenchimento de uma campanha porque um polling agressivo de status derruba o usuário sem salvar o que ele estava fazendo.
**Aplica-se a:** billing status sync (efeito no frontend/UX).
**Como detectar cedo:** perguntar explicitamente: "o que deve acontecer na tela ativa do usuário quando o status muda no meio da sessão — bloqueio imediato, aviso não-bloqueante, ou só afeta o próximo login?"
**Como prevenir:** decidir e documentar o comportamento (sugestão: nunca interromper uma ação em andamento — como criação/edição de campanha — no meio; verificar status de billing só em pontos de transição seguros, como troca de página ou ao tentar uma ação que consome recurso pago, ex: disparar campanha nova). Diferenciar "Em atraso" (aviso, ainda funciona) de "Cancelada" (bloqueio real) explicitamente na UI — não tratar os dois com a mesma tela de bloqueio.

---

## 4. Import de Leads via CSV do LinkedIn com Tag de Origem

### P4.1 — Detecção de duplicata cruzando duas origens diferentes
**O que dá errado:** Um contato já existe na base (veio de cadastro direto na clínica, com telefone formatado `+55 11 98888-7777`) e o mesmo lead aparece no export do LinkedIn com telefone formatado diferente (`11988887777`, ou `(11) 98888-7777`, ou com o nono dígito faltando/sobrando). Se a checagem de duplicata for uma comparação de string exata, o import cria um contato duplicado em vez de mesclar/atualizar o existente — e pior, o duplicado novo pode não ter a tag/status de opt-out que o original tinha.
**Aplica-se a:** CSV import.
**Como detectar cedo:** testar o import com uma lista de teste que contenha propositalmente 2-3 números que já existem na base, mas formatados de forma diferente do que está salvo.
**Como prevenir:** normalizar telefone para um formato canônico único (ex: E.164, só dígitos com código do país) ANTES de comparar, tanto na hora de gravar quanto na hora de checar duplicata — nunca comparar strings de telefone "como vieram". Fazer o mesmo tratamento para nome (case-insensitive, trim) se for usado como critério secundário de dedup.

### P4.2 — Peculiaridades de formato do export CSV do LinkedIn
**O que dá errado:** Exports de leads do LinkedIn (Lead Gen Forms / Sales Navigator) têm nomes de coluna que variam por idioma da conta (`Phone Number` vs `Número de telefone`), podem ter BOM/encoding UTF-8 com caracteres especiais quebrados, colunas com telefone vazio (LinkedIn não garante que o campo foi preenchido pelo lead) e datas em formato americano (MM/DD/YYYY) que podem ser mal interpretadas como DD/MM se o parser assumir formato brasileiro.
**Aplica-se a:** CSV import.
**Como detectar cedo:** conseguir um export real (ou simulado com as colunas documentadas do LinkedIn) antes de escrever o parser, em vez de assumir um CSV "limpo" genérico — testar com pelo menos um arquivo com acentos/caracteres especiais no nome.
**Como prevenir:** mapear colunas por nome de forma tolerante (normalizar case/acentos ao comparar headers, não exigir nome exato), tratar linhas sem telefone como erro reportado ao usuário (não como contato "vazio" silencioso), e não assumir nenhum formato de data sem detectar explicitamente ou perguntar ao usuário no momento do import.

### P4.3 — Reimportar contato que já deu opt-out
**O que dá errado:** Um lead do LinkedIn pediu para sair da lista da clínica há 2 meses (opt-out registrado, `status='opted_out'` ou tag equivalente). Meses depois, alguém reimporta uma planilha do LinkedIn que contém esse mesmo lead (a pessoa nunca saiu do LinkedIn, só pediu pra não receber WhatsApp) — se o import não checar status de opt-out antes de reativar/reinserir, o contato volta a receber campanhas. Isso é o pitfall de dado mais sério desta feature porque combina risco de LGPD com risco de reputação (mensagem pra quem já pediu explicitamente pra parar).
**Aplica-se a:** CSV import.
**Como detectar cedo:** incluir de propósito, no teste de import, um contato de teste marcado como opt-out e verificar se ele é ignorado/sinalizado em vez de reativado.
**Como prevenir:** a checagem de opt-out deve rodar ANTES da checagem de duplicata comum, usando a mesma normalização de telefone do P4.1 (senão o opt-out não é reconhecido pelo mesmo motivo de formato). Contato com opt-out ativo encontrado no CSV deve ser automaticamente EXCLUÍDO do import (não reativado), com um aviso visível no resumo do import ("3 contatos ignorados por opt-out prévio") — nunca falhar silenciosamente nem reverter o opt-out sem confirmação humana explícita.

---

## 5. Pitfall de Compliance/Reputacional: Importar Leads do LinkedIn para Disparo no WhatsApp

Esta é a preocupação que o usuário sinalizou explicitamente como sensível — tratando à parte porque é transversal à feature 4 e tem risco de conta banida (WhatsApp) e risco de conta do LinkedIn suspensa, não só risco de dado errado.

### P5.1 — Ausência de opt-in específico para WhatsApp
**O que dá errado:** Um lead preencheu um formulário do LinkedIn (Lead Gen Form) autorizando contato "pela LinkedIn" ou fornecendo o telefone para "a empresa entrar em contato" de forma genérica — isso NÃO é, no entendimento do WhatsApp Business Policy, o mesmo que consentimento para receber mensagens automatizadas/em massa via WhatsApp. O WhatsApp exige que o número tenha optado especificamente por receber mensagens daquela empresa via WhatsApp (opt-in), e reclamações de usuários que não reconhecem a origem do contato ("quem é você, nunca dei meu WhatsApp pra vocês") aumentam a taxa de bloqueio/denúncia, que é justamente o sinal que a Meta usa para pausar ou banir números.
**Aplica-se a:** CSV import + status lifecycle (contato "frio" sem opt-in tende a ter taxa de resposta/interação baixa, o que já é um sinal ruim combinado com o risco de banimento).
**Como detectar cedo:** antes de liberar a feature, decidir e documentar a política: o sistema vai permitir enviar a PRIMEIRA mensagem para um lead importado do LinkedIn sem opt-in prévio de WhatsApp, ou vai exigir uma etapa intermediária (ex: primeira mensagem só pode ser um convite pra confirmar interesse, nunca uma campanha promocional direta)?
**Como prevenir:** tratar contatos importados via LinkedIn com uma tag de origem obrigatória (a própria feature já prevê isso) e usar essa tag para aplicar uma regra diferente na primeira mensagem: template de "confirmação de opt-in" (baixo volume, claramente identificando a origem — "Você preencheu o formulário X no LinkedIn, podemos continuar por aqui?") em vez de entrar direto no fluxo de campanha em massa da clínica. Isso também protege a conta do WhatsApp reduzindo taxa de denúncia nos primeiros contatos, que é quando a Meta mais penaliza números novos/pouco estabelecidos.

### P5.2 — Volume e velocidade de disparo para lista "fria" recém-importada
**O que dá errado:** Diferente da base já engajada da clínica (que responde, abre, interage), uma lista nova importada do LinkedIn tende a ter taxa de bloqueio/denúncia mais alta nas primeiras mensagens. Se o sistema trata contatos recém-importados exatamente igual à base antiga em termos de volume/velocidade de disparo (mesmo "daily budget" e mesmo ritmo), o risco de a Meta sinalizar o número por spam sobe — e como ZapFlow já tem lógica de budget diário (`supabase_automacoes_avancadas.sql`), essa lógica precisa considerar taxa de qualidade por segmento, não só quantidade total.
**Aplica-se a:** CSV import + status lifecycle (relação com o motor de disparo existente).
**Como detectar cedo:** perguntar se existe hoje alguma diferenciação de ritmo de envio por "temperatura" do contato — hoje não existe (todo contato Ativo é tratado igual pelo motor de envio).
**Como prevenir:** na v1, no mínimo, não deixar o import CSV alimentar diretamente uma campanha de disparo imediato em massa — a tag de origem ("LinkedIn") deveria ser usada para limitar a primeira campanha a esses contatos a um volume/ritmo reduzido e monitorável, com checagem manual de taxa de erro/bloqueio antes de escalar.

### P5.3 — Risco reputacional para a conta do LinkedIn do cliente, não só para o WhatsApp
**O que dá errado:** Se o cliente (a clínica) está exportando leads de forma que viole os termos de uso do LinkedIn (ex: scraping de perfis, uso de ferramentas de automação não-oficiais para gerar o CSV, exportação em volume que excede uso normal de Sales Navigator), o risco de suspensão de conta é do LinkedIn do PRÓPRIO CLIENTE, não do ZapFlow — mas se o ZapFlow documenta/incentiva esse fluxo sem ressalva, cria exposição reputacional própria ("ferramenta que ensina a violar termos de terceiros").
**Aplica-se a:** CSV import (escopo de produto/comunicação, não só código).
**Como detectar cedo:** revisar qualquer texto de UI/ajuda que a feature vá ter ("como exportar seus leads do LinkedIn") para não instruir métodos que violem os termos do LinkedIn.
**Como prevenir:** a feature deve importar CSV genericamente (não fazer scraping nem integração direta com LinkedIn via API não-oficial) e o texto de ajuda deve deixar claro que a responsabilidade pela origem lícita dos dados (export manual autorizado, Lead Gen Forms oficiais, Sales Navigator dentro dos limites de uso) é do cliente — o ZapFlow processa o arquivo, não determina como ele foi obtido. Isso é mais uma nota de produto/legal do que uma decisão técnica, mas vale registrar para a fase de planejamento não assumir que "é só um CSV, sem implicação".

---

## Resumo Rápido por Feature (para checklist de planejamento)

| Feature | Pitfalls críticos a endereçar no plano |
|---|---|
| Status lifecycle automático | P1.1 (timezone), P1.2 (import não deve disparar transição em massa), P1.3 (race com envio de campanha), P1.4 (auditoria mínima) |
| Dashboard de consumo | P2.1 (off-by-one, limite único centralizado), P2.2 (contagem live, não cache esquecido), P2.3 (política de grace period definida ANTES de implementar) |
| Billing sync via webhook MP | P3.1 (idempotência de side-effects), P3.2 (comparar timestamp/versão, não sobrescrever cegamente), P3.3 (ativar secret/considerar signature antes de expandir escopo do webhook), P3.4 (comportamento de sessão ativa definido) |
| CSV import LinkedIn | P4.1 (normalizar telefone antes de comparar), P4.2 (testar com export real, não CSV genérico assumido), P4.3 (checar opt-out ANTES de tudo), P5.1/P5.2/P5.3 (opt-in específico de WhatsApp, ritmo reduzido pra lista fria, responsabilidade de origem lícita) |
