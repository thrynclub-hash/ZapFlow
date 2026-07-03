// Helpers usados pelo front-end do cliente. Nada aqui fala com a Z-API
// diretamente — todo envio real e checagem de status passam por Edge
// Functions (send-message, run-automations, zapi-status), que seguram o
// zapi_token no servidor. Removido em 2026-07-03: sendImageMessage,
// sendTextMessage, checkInstanceStatus e formatPhone chamavam
// api.z-api.io direto do navegador, o que exigia mandar o zapi_token pro
// cliente — um bug de segurança real (ver Settings.jsx e
// supabase/functions/zapi-status). Eram funções não usadas de verdade em
// nenhum envio real (a Settings.jsx era a única que ainda chamava
// checkInstanceStatus), então a remoção não muda nenhuma funcionalidade.

/**
 * Faz sleep entre envios para evitar ban
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
