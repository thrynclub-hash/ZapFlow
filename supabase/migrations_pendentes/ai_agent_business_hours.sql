-- Agente de IA: handoff humano por horario (2026-11-09). Fora do
-- horario configurado, o agente nao chama o modelo (economiza custo e
-- evita prometer algo fora de hora) -- so manda a mensagem de ausencia
-- e avisa a equipe, igual um atendente real faria.
--
-- Formato de ai_business_hours: {"mon": {"start":"09:00","end":"18:00"}, ...}
-- dia ausente da chave = fechado nesse dia. Chaves: mon,tue,wed,thu,fri,sat,sun.
alter table reply_flows add column if not exists ai_business_hours jsonb;
alter table reply_flows add column if not exists ai_handoff_message text
  default 'Nosso atendimento automático está fora do horário agora. Já avisei a equipe, te respondem assim que possível!';
alter table reply_flows add column if not exists ai_timezone text default 'America/Sao_Paulo';
