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

// Bug real corrigido em 2026-07-06: os ids de botão/sub-opção de resposta
// rápida (Campaigns.jsx e NewCampaign.jsx) eram gerados como `opt_${length+1}`
// / `sub_${length+1}` — baseado no TAMANHO atual da lista, não num contador
// que nunca repete. Adicionar 3 sub-opções, remover uma do meio e adicionar
// outra gera o MESMO id de uma que já existe (aconteceu de verdade: duas
// opções "Harmonização" e "Outro" ficaram com id "sub_3" na mesma campanha),
// o que confunde qual foi escolhida quando o cliente responde pelo botão.
export function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
