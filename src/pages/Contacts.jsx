import { useEffect, useRef, useState } from 'react'
import { Upload, Plus, Search, Trash2, Download, Users, MessageCircle, Tag, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import * as XLSX from 'xlsx'
import Modal from '../components/Modal'

// Número de WhatsApp para pedir mais capacidade (order bump) — enquanto
// não existe checkout automático, o cliente clica e já cai numa conversa
// pronta pedindo o add-on; Leonardo cobra manualmente e libera em Clientes.
const SUPPORT_WHATSAPP = '5519997051919'
function addonLink(kind, companyName) {
  const label = kind === 'contacts' ? '+1000 contatos' : '+1 número de WhatsApp'
  const text = `Oi! Sou d${companyName ? 'a empresa ' + companyName : 'o ZapFlow'} e quero contratar o add-on "${label}" no meu plano.`
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`
}

export default function Contacts() {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState([])
  const [numbers, setNumbers] = useState([])
  const [search, setSearch] = useState('')
  const [filterNumber, setFilterNumber] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [importTag, setImportTag] = useState('Novo')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', birth_date: '', number_id: '', tags: '' })
  const [importTarget, setImportTarget] = useState('')
  const [importSummary, setImportSummary] = useState(null)
  const [planLimit, setPlanLimit] = useState(null) // { plan, numbers_limit, contacts_limit }
  const fileRef = useRef()

  const clientId = profile?.client_id

  useEffect(() => { if (clientId) { fetchContacts(); fetchNumbers(); fetchPlanLimit() } }, [clientId])

  async function fetchPlanLimit() {
    const { data: client } = await supabase.from('clients').select('plan').eq('id', clientId).single()
    if (!client?.plan) return
    const { data: limit } = await supabase.from('plan_limits').select('*').eq('plan', client.plan).single()
    if (!limit) return
    // Limite efetivo = limite do plano + add-ons avulsos de +1000 contatos
    // (order bump — cliente não precisa trocar de plano inteiro só pra
    // caber mais um pouco).
    const { data: addons } = await supabase.from('client_addons').select('quantity').eq('client_id', clientId).eq('addon_type', 'contacts_1000').eq('status', 'active')
    const extra = (addons || []).reduce((s, a) => s + a.quantity, 0) * 1000
    setPlanLimit({ ...limit, contacts_limit: limit.contacts_limit != null ? limit.contacts_limit + extra : null, base_contacts_limit: limit.contacts_limit })
  }

  async function fetchNumbers() {
    const { data } = await supabase.from('client_numbers').select('*').eq('client_id', clientId).eq('active', true)
    setNumbers(data || [])
    if (data?.length === 1) setImportTarget(data[0].id)
  }

  // Bug real reportado pelo Leonardo: "diz 1000 mas eu sei que tem mais, e
  // quando adicionei não mudou". Causa: o Supabase/PostgREST devolve no
  // MÁXIMO 1000 linhas por select, mesmo sem LIMIT explícito no código —
  // é um teto padrão do projeto. Sem paginar, qualquer cliente com mais de
  // 1000 contatos ficava com a lista (e a contagem, e a exportação, e o
  // bloqueio de limite do plano) travada no primeiro milhar pra sempre,
  // e novo contato adicionado nunca aparecia no total mostrado. Corrigido
  // buscando em páginas de 1000 até a página vir incompleta (= acabou).
  async function fetchContacts() {
    const PAGE_SIZE = 1000
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase.from('contacts').select('*, number:client_numbers(label)')
        .eq('client_id', clientId).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
      if (error) { console.error('Erro buscando contatos:', error); break }
      all = all.concat(data || [])
      if (!data || data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
    setContacts(all)
    setLoading(false)
  }

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const matchNumber = !filterNumber || c.number_id === filterNumber
    const matchTag = !filterTag || (Array.isArray(c.tags) && c.tags.includes(filterTag))
    return matchSearch && matchNumber && matchTag
  })

  // Lista de tags únicas já em uso, pro filtro — "Antigo"/"Novo" sempre
  // aparecem primeiro (são as tags do fluxo combinado com o Leonardo),
  // o resto (tags livres que o cliente cria) vem depois em ordem alfabética.
  const allTags = Array.from(new Set(contacts.flatMap(c => Array.isArray(c.tags) ? c.tags : [])))
  const tagOptions = [...['Antigo', 'Novo'].filter(t => allTags.includes(t)), ...allTags.filter(t => t !== 'Antigo' && t !== 'Novo').sort()]

  async function handleAdd(e) {
    e.preventDefault()
    if (planLimit?.contacts_limit != null && contacts.length >= planLimit.contacts_limit) {
      setErrorMsg(`Seu plano (${planLimit.plan}) permite até ${planLimit.contacts_limit.toLocaleString()} contatos. Fale com o administrador pra aumentar.`)
      return
    }
    setSaving(true)
    setErrorMsg('')
    const { error } = await supabase.from('contacts').insert({
      name: form.name,
      phone: form.phone.replace(/\D/g, ''),
      birth_date: form.birth_date || null,
      number_id: form.number_id || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
      client_id: clientId,
    })
    if (error) {
      setErrorMsg(error.message)
    } else {
      setShowAdd(false)
      setForm({ name: '', phone: '', birth_date: '', number_id: '', tags: '' })
      fetchContacts()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Remover este contato?')) return
    await supabase.from('contacts').delete().eq('id', id)
    setContacts(c => c.filter(x => x.id !== id))
  }

  // Toggle rápido Ativo/Inativo — pra quando o Leonardo/cliente perceber
  // que um contato específico faz tempo que não aparece/não responde.
  async function toggleStatus(contact) {
    const next = contact.status === 'Ativo' ? 'Inativo' : 'Ativo'
    setContacts(cs => cs.map(x => x.id === contact.id ? { ...x, status: next } : x))
    await supabase.from('contacts').update({ status: next }).eq('id', contact.id)
  }

  // Edição rápida de tags direto na lista (ex: trocar "Novo" por "Antigo"
  // depois de um tempo, ou adicionar uma tag livre).
  async function editTags(contact) {
    const current = Array.isArray(contact.tags) ? contact.tags.join(', ') : ''
    const input = prompt('Tags deste contato (separadas por vírgula):', current)
    if (input === null) return
    const tags = input.split(',').map(t => t.trim()).filter(Boolean)
    setContacts(cs => cs.map(x => x.id === contact.id ? { ...x, tags } : x))
    await supabase.from('contacts').update({ tags }).eq('id', contact.id)
  }

  // Normaliza cabeçalho de coluna: minúsculas, sem acento, sem espaço/pontuação —
  // assim "Número", "numero ", "NÚMERO", "N° Whatsapp" etc. todos batem no mesmo alias.
  function normalizeHeader(h) {
    return String(h || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
  }

  const NAME_ALIASES = ['nome', 'name', 'contato', 'cliente', 'nomecompleto', 'paciente']
  const PHONE_ALIASES = ['numero', 'telefone', 'phone', 'celular', 'whatsapp', 'fone', 'contato1', 'numerowhatsapp', 'tel']
  const BIRTH_ALIASES = ['nascimento', 'birthdate', 'aniversario', 'datadenascimento', 'dtnascimento']

  function findByAlias(rowNormalized, aliases) {
    for (const alias of aliases) {
      if (alias in rowNormalized) return rowNormalized[alias]
    }
    return ''
  }

  // Aceita ISO (YYYY-MM-DD), BR (DD/MM/AAAA ou DD-MM-AAAA) e datas seriais do Excel.
  function parseBirthDate(raw) {
    if (!raw) return null
    if (typeof raw === 'number') {
      // Data serial do Excel (dias desde 1899-12-30)
      const d = new Date(Math.round((raw - 25569) * 86400 * 1000))
      if (isNaN(d.getTime())) return null
      return d.toISOString().slice(0, 10)
    }
    const s = String(raw).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
    if (br) {
      let [, dd, mm, yyyy] = br
      if (yyyy.length === 2) yyyy = '20' + yyyy
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    return null
  }

  async function handleImportCSV(e) {
    const file = e.target.files[0]
    if (!file) return
    if (numbers.length > 1 && !importTarget) {
      alert('Selecione para qual loja/número esses contatos são antes de importar.')
      e.target.value = ''
      return
    }
    setImporting(true)
    setImportSummary(null)
    const reader = new FileReader()
    const targetNumberId = importTarget || numbers[0]?.id || null
    const nowIso = new Date().toISOString()

    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { raw: true })

        const toInsert = rows.map(r => {
          const rowNormalized = {}
          for (const key of Object.keys(r)) rowNormalized[normalizeHeader(key)] = r[key]

          const name = String(findByAlias(rowNormalized, NAME_ALIASES) || '').trim()
          const phone = String(findByAlias(rowNormalized, PHONE_ALIASES) || '').replace(/\D/g, '')
          const birth_date = parseBirthDate(findByAlias(rowNormalized, BIRTH_ALIASES))

          return {
            client_id: clientId,
            number_id: targetNumberId,
            name,
            phone,
            birth_date,
            status: 'Ativo',
            imported_at: nowIso,
          }
        }).filter(c => c.phone.length >= 8 && c.name)

        // Dedup dentro do próprio arquivo (mesma planilha com o mesmo telefone 2x) —
        // fica só a última ocorrência, senão o upsert em lote pode brigar consigo mesmo.
        const byPhone = new Map()
        for (const c of toInsert) byPhone.set(c.phone, c)
        const deduped = Array.from(byPhone.values())

        // Limite do plano: contato que JÁ EXISTE (vai ser atualizado) nunca
        // é bloqueado — só CONTATO NOVO conta pro limite. Se o plano permite
        // menos novos do que vieram na planilha, importa até o limite e avisa.
        const existingPhones = new Set(contacts.map(c => c.phone))
        const toUpdate = deduped.filter(c => existingPhones.has(c.phone))
        const toCreate = deduped.filter(c => !existingPhones.has(c.phone))
        let blockedByPlan = 0
        let allowedNew = toCreate
        if (planLimit?.contacts_limit != null) {
          const remaining = Math.max(0, planLimit.contacts_limit - contacts.length)
          if (toCreate.length > remaining) {
            blockedByPlan = toCreate.length - remaining
            allowedNew = toCreate.slice(0, remaining)
          }
        }
        // A tag do lote (ex: "Novo") só vai pros contatos REALMENTE novos.
        // Importante: o upsert em lote do PostgREST exige que TODAS as linhas
        // tenham exatamente as mesmas colunas — por isso toda linha leva um
        // campo "tags" explícito; contato que já existia (toUpdate) recebe de
        // volta a MESMA tag que já tinha (nunca fica sem, nunca é sobrescrito
        // pela tag do lote), e só quem é novo de fato ganha a tag do import.
        const existingTagsByPhone = new Map(contacts.map(c => [c.phone, Array.isArray(c.tags) ? c.tags : []]))
        const toUpdateTagged = toUpdate.map(c => ({ ...c, tags: existingTagsByPhone.get(c.phone) || [] }))
        const allowedNewTagged = allowedNew.map(c => ({ ...c, tags: importTag ? [importTag] : [] }))
        const toUpsert = [...toUpdateTagged, ...allowedNewTagged]

        // upsert com onConflict client_id+phone: contato existente é ATUALIZADO
        // (nome/loja/nascimento/imported_at), não duplicado — a linha nunca é
        // recriada, então created_at original se preserva.
        for (let i = 0; i < toUpsert.length; i += 100) {
          const { error } = await supabase.from('contacts').upsert(toUpsert.slice(i, i + 100), { onConflict: 'client_id,phone' })
          if (error) throw error
        }

        await fetchContacts()
        const skipped = rows.length - toInsert.length
        const duplicatesInFile = toInsert.length - deduped.length
        setImportSummary({ imported: toUpsert.length, skipped, duplicatesInFile, blockedByPlan, planLimit: planLimit?.contacts_limit, total: rows.length })
      } catch (err) {
        alert('Erro ao importar: ' + err.message)
      }
      setImporting(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  function exportExcel() {
    const data = filtered.map(c => ({
      Nome: c.name, Telefone: c.phone,
      Loja: c.number?.label || '',
      Nascimento: c.birth_date || '',
      Tags: Array.isArray(c.tags) ? c.tags.join(', ') : '',
      Cadastrado: new Date(c.created_at).toLocaleDateString('pt-BR'),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos')
    XLSX.writeFile(wb, `contatos_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Contatos</h1>
          <p className="text-muted text-sm font-body mt-1">
            {contacts.length.toLocaleString()} contatos cadastrados
            {planLimit && (planLimit.contacts_limit != null
              ? <span className={contacts.length >= planLimit.contacts_limit ? 'text-red-400' : 'text-muted'}> · plano {planLimit.plan}: até {planLimit.contacts_limit.toLocaleString()}</span>
              : <span className="text-muted"> · plano {planLimit.plan}: ilimitado</span>)}
          </p>
          {planLimit?.contacts_limit != null && contacts.length >= planLimit.contacts_limit * 0.9 && (
            <a href={addonLink('contacts', profile?.client?.name)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-body text-green-400 hover:underline mt-1">
              <MessageCircle size={12} /> Quase no limite — pedir +1000 contatos (add-on, sem trocar de plano)
            </a>
          )}
        </div>
        <div className="flex gap-3 items-center">
          {numbers.length > 1 && (
            <select value={importTarget} onChange={e => setImportTarget(e.target.value)}
              title="Loja/número de destino para a próxima importação"
              className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
              <option value="">Importar para qual loja?</option>
              {numbers.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          )}
          <input value={importTag} onChange={e => setImportTag(e.target.value)}
            title='Tag aplicada só nos contatos NOVOS deste import (contato que já existia mantém a tag que já tinha)'
            placeholder="Tag do import (ex: Novo)"
            className="w-40 bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent" />
          <button onClick={exportExcel} className="flex items-center gap-2 border border-border text-muted hover:text-white px-4 py-2 rounded-lg text-sm font-body transition-colors">
            <Download size={14} /> Exportar
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportCSV} className="hidden" />
          <button onClick={() => fileRef.current.click()} disabled={importing}
            className="flex items-center gap-2 border border-accent/50 text-accent hover:bg-accent hover:text-bg px-4 py-2 rounded-lg text-sm font-body transition-colors disabled:opacity-50">
            <Upload size={14} /> {importing ? 'Importando...' : 'Importar CSV/Excel'}
          </button>
          <button onClick={() => { setShowAdd(true); setErrorMsg('') }}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg px-4 py-2 rounded-lg text-sm font-display font-bold transition-colors">
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>

      {importSummary && (
        <div className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${importSummary.blockedByPlan > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-accent/10 border-accent/30'}`}>
          <p className="text-sm font-body text-white">
            ✅ <strong>{importSummary.imported}</strong> contatos importados/atualizados (duplicados por telefone foram atualizados, não duplicados)
            {importSummary.skipped > 0 && <> · <span className="text-amber-300">{importSummary.skipped} ignorados</span> (sem nome ou telefone válido)</>}
            {importSummary.duplicatesInFile > 0 && <> · {importSummary.duplicatesInFile} repetidos dentro da própria planilha</>}
            {importSummary.blockedByPlan > 0 && <> · <span className="text-amber-300 font-medium">{importSummary.blockedByPlan} não importados — limite do plano ({importSummary.planLimit?.toLocaleString()} contatos) atingido.</span></>}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            {importSummary.blockedByPlan > 0 && (
              <a href={addonLink('contacts', profile?.client?.name)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-body text-green-400 hover:underline whitespace-nowrap">
                <MessageCircle size={12} /> Quero +1000 contatos
              </a>
            )}
            <button onClick={() => setImportSummary(null)} className="text-muted hover:text-white text-xs shrink-0">fechar</button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
        </div>
        {numbers.length > 1 && (
          <select value={filterNumber} onChange={e => setFilterNumber(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
            <option value="">Todas as lojas</option>
            {numbers.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        )}
        {tagOptions.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
            <option value="">Todas as tags</option>
            {tagOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted font-body">
          <strong className="text-white">Como importar:</strong> qualquer planilha com uma coluna de nome (ex: "Nome", "Cliente", "Paciente") e uma de telefone (ex: "Telefone", "WhatsApp", "Celular") funciona — não precisa ser sempre o mesmo formato. Nascimento é opcional (DD/MM/AAAA ou AAAA-MM-DD). Contatos com o mesmo telefone de um já existente são <strong className="text-white">atualizados</strong>, nunca duplicados — e mantêm as tags que já tinham. A "Tag do import" (campo ao lado do botão) só é aplicada em quem é <strong className="text-white">realmente novo</strong> nesta planilha.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <Users size={40} className="text-muted mx-auto mb-4" />
          <p className="text-white font-body font-medium mb-1">Nenhum contato encontrado</p>
          <p className="text-muted text-sm font-body">Importe uma planilha ou adicione manualmente</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Nome</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Telefone</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Loja</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Tags</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Status</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Nascimento</th>
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Importado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-white font-body font-medium">{c.name}</td>
                  <td className="px-5 py-3.5 text-sm text-muted font-body">{c.phone}</td>
                  <td className="px-5 py-3.5 text-sm text-muted font-body">{c.number?.label || '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1 items-center">
                      {(Array.isArray(c.tags) ? c.tags : []).map(t => (
                        <span key={t} className={`px-2 py-0.5 rounded text-xs font-body ${t === 'Novo' ? 'bg-blue-400/10 text-blue-300' : t === 'Antigo' ? 'bg-muted/10 text-muted' : 'bg-accent/10 text-accent'}`}>{t}</span>
                      ))}
                      <button onClick={() => editTags(c)} title="Editar tags" className="text-muted hover:text-accent transition-colors p-0.5"><Pencil size={11} /></button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleStatus(c)} title="Clique para alternar Ativo/Inativo"
                      className={`px-2 py-1 rounded text-xs font-body transition-colors ${c.status === 'Inativo' ? 'bg-muted/10 text-muted hover:bg-muted/20' : 'bg-green-400/10 text-green-400 hover:bg-green-400/20'}`}>
                      {c.status === 'Inativo' ? 'Inativo' : 'Ativo'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted font-body">
                    {c.birth_date ? new Date(c.birth_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted font-body">{c.imported_at ? new Date(c.imported_at).toLocaleDateString('pt-BR') : new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => handleDelete(c.id)} className="text-muted hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein">
            <h3 className="font-display font-bold text-xl text-white mb-6">Adicionar contato</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <Field label="Nome completo *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
              <Field label="Telefone (com DDD) *" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="19999999999" required />
              <Field label="Data de nascimento" type="date" value={form.birth_date} onChange={v => setForm(f => ({ ...f, birth_date: v }))} />
              {numbers.length > 0 && (
                <div>
                  <label className="block text-xs text-muted font-body mb-1.5">Loja</label>
                  <select value={form.number_id} onChange={e => setForm(f => ({ ...f, number_id: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body focus:outline-none focus:border-accent">
                    <option value="">Sem loja específica</option>
                    {numbers.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                </div>
              )}
              <Field label="Tags (separadas por vírgula)" value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="Novo" />
              <p className="text-xs text-muted font-body -mt-2">Convenção combinada: use "Novo" pra contato recém-cadastrado — os que já estavam na base foram marcados como "Antigo".</p>
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 space-y-2">
                  <p className="text-red-400 text-xs font-body">{errorMsg}</p>
                  <a href={addonLink('contacts', profile?.client?.name)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-body text-green-400 hover:underline">
                    <MessageCircle size={12} /> Quero +1000 contatos agora
                  </a>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-border text-muted py-2.5 rounded-lg text-sm font-body hover:text-white transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="block text-xs text-muted font-body mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-white font-body placeholder-muted/50 focus:outline-none focus:border-accent transition-colors" />
    </div>
  )
}
