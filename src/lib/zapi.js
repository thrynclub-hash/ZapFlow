// Z-API integration helpers
// Base URL da Z-API
const ZAPI_BASE = 'https://api.z-api.io/instances'

/**
 * Envia imagem + texto para um número via Z-API
 * @param {string} instanceId - ID da instância Z-API
 * @param {string} token - Token da instância Z-API
 * @param {string} phone - Número do destinatário (5511999999999)
 * @param {string} imageUrl - URL pública da imagem
 * @param {string} caption - Legenda da mensagem
 */
export async function sendImageMessage(instanceId, token, phone, imageUrl, caption) {
  const url = `${ZAPI_BASE}/${instanceId}/token/${token}/send-image`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': token },
    body: JSON.stringify({ phone, image: imageUrl, caption }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Z-API error: ${res.status}`)
  }
  return res.json()
}

/**
 * Envia texto simples para um número via Z-API
 */
export async function sendTextMessage(instanceId, token, phone, message) {
  const url = `${ZAPI_BASE}/${instanceId}/token/${token}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': token },
    body: JSON.stringify({ phone, message }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Z-API error: ${res.status}`)
  }
  return res.json()
}

/**
 * Verifica status da instância Z-API
 */
export async function checkInstanceStatus(instanceId, token) {
  const url = `${ZAPI_BASE}/${instanceId}/token/${token}/status`
  const res = await fetch(url, {
    headers: { 'Client-Token': token },
  })
  if (!res.ok) return { connected: false }
  const data = await res.json()
  return { connected: data.connected, number: data.phone }
}

/**
 * Formata número para padrão Z-API (5511999999999)
 */
export function formatPhone(phone) {
  return phone.replace(/\D/g, '').replace(/^0/, '55')
}

/**
 * Faz sleep entre envios para evitar ban
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
