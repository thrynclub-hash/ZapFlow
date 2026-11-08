// ZapFlow — Agente local de impressão (2026-11-07)
// Roda no PC da loja, perto da impressora. Busca print_jobs pendentes a
// cada poucos segundos e imprime via ESC/POS (interface de rede — a
// maioria das térmicas BR modernas tem Wi-Fi/Ethernet, porta 9100).
//
// NÃO TESTADO AO VIVO — ninguém ligou numa impressora real ainda.
//
// Config: copia .env.example pra .env e preenche antes de rodar.
//   npm install
//   npm start

import 'dotenv/config'
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'

const ZAPFLOW_API = process.env.ZAPFLOW_API || 'https://bhiggyigsrqfabqhutne.supabase.co/functions/v1/print-agent'
const AGENT_TOKEN = process.env.AGENT_TOKEN
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'tcp://192.168.0.50:9100'
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000)

if (!AGENT_TOKEN) {
  console.error('Falta AGENT_TOKEN no .env — pega esse token no painel admin do ZapFlow (Configurações > Agente de Impressão).')
  process.exit(1)
}

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON, // compatível com a maioria das térmicas ESC/POS BR (Elgin, Bematech)
  interface: PRINTER_INTERFACE,
  removeSpecialCharacters: false,
  options: { timeout: 5000 },
})

async function printJob(job) {
  printer.clear()
  if (job.title) {
    printer.alignCenter()
    printer.bold(true)
    printer.println(job.title)
    printer.bold(false)
    printer.alignLeft()
    printer.drawLine()
  }
  for (const line of job.lines || []) printer.println(line)
  printer.cut()
  await printer.execute()
}

async function ack(jobId, success) {
  await fetch(`${ZAPFLOW_API}?action=ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-token': AGENT_TOKEN },
    body: JSON.stringify({ job_id: jobId, success }),
  })
}

async function tick() {
  try {
    const res = await fetch(`${ZAPFLOW_API}?action=poll`, { headers: { 'x-agent-token': AGENT_TOKEN } })
    const data = await res.json()
    if (!data.ok) { console.error('poll falhou:', data.error); return }
    for (const job of data.jobs) {
      try {
        await printJob(job)
        await ack(job.id, true)
        console.log(`Impresso: ${job.title || job.id}`)
      } catch (printErr) {
        console.error(`Erro imprimindo job ${job.id}:`, printErr.message)
        await ack(job.id, false)
      }
    }
  } catch (e) {
    console.error('Erro no poll:', e.message)
  }
}

console.log(`Agente de impressão ZapFlow rodando. Impressora: ${PRINTER_INTERFACE}. Verificando a cada ${POLL_INTERVAL_MS / 1000}s.`)
setInterval(tick, POLL_INTERVAL_MS)
tick()
