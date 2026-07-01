import { useEffect, useRef, useState } from 'react'
import { Upload, Plus, Search, Trash2, Download, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import * as XLSX from 'xlsx'
import Modal from '../components/Modal'

export default function Contacts() {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState([])
  const [numbers, setNumbers] = useState([])
  const [search, setSearch] = useState('')
  const [filterNumber, setFilterNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', birth_date: '', number_id: '', tags: '' })
  const [importTarget, setImportTarget] = useState('')
  const [importSummary, setImportSummary] = useState(null)
  const fileRef = useRef()

  const clientId = profile?.client_id

  useEffect(() => { if (clientId) { fetchContacts(); fetchNumbers() } }, [clientId])

  async function fetchNumbers() {
    const { data } = await supabase.from('client_numbers').select('*').eq('client_id', clientId).eq('active', true)
    setNumbers(data || [])
    if (data?.length === 1) setImportTarget(data[0].id)
  }

  async function fetchContacts() {
    const { data } = await supabase.from('contacts').select('*, number:client_numbers(label)').eq('client_id', clientId).order('created_at', { ascending: false })
    setContacts(data || [])
    setLoading(false)
  }

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const matchNumber = !filterNumber || c.number_id === filterNumber
    return matchSearch && matchNumber
  })

  async function handleAdd(e) {
    e.preventDefault()
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

        // upsert com onConflict client_id+phone: contato existente é ATUALIZADO
        // (nome/loja/nascimento/imported_at), não duplicado — a linha nunca é
        // recriada, então created_at original se preserva.
        for (let i = 0; i < deduped.length; i += 100) {
          const { error } = await supabase.from('contacts').upsert(deduped.slice(i, i + 100), { onConflict: 'client_id,phone' })
          if (error) throw error
        }

        await fetchContacts()
        const skipped = rows.length - toInsert.length
        const duplicatesInFile = toInsert.length - deduped.length
        setImportSummary({ imported: deduped.length, skipped, duplicatesInFile, total: rows.length })
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
          <p className="text-muted text-sm font-body mt-1">{contacts.length.toLocaleString()} contatos cadastrados</p>
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
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-start justify-between gap-4">
          <p className="text-sm font-body text-white">
            ✅ <strong>{importSummary.imported}</strong> contatos importados/atualizados (duplicados por telefone foram atualizados, não duplicados)
            {importSummary.skipped > 0 && <> · <span className="text-amber-300">{importSummary.skipped} ignorados</span> (sem nome ou telefone válido)</>}
            {importSummary.duplicatesInFile > 0 && <> · {importSummary.duplicatesInFile} repetidos dentro da própria planilha</>}
          </p>
          <button onClick={() => setImportSummary(null)} className="text-muted hover:text-white text-xs shrink-0">fechar</button>
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
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted font-body">
          <strong className="text-white">Como importar:</strong> qualquer planilha com uma coluna de nome (ex: "Nome", "Cliente", "Paciente") e uma de telefone (ex: "Telefone", "WhatsApp", "Celular") funciona — não precisa ser sempre o mesmo formato. Nascimento é opcional (DD/MM/AAAA ou AAAA-MM-DD). Contatos com o mesmo telefone de um já existente são <strong className="text-white">atualizados</strong>, nunca duplicados.
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
              <Field label="Tags (separadas por vírgula)" value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="vip, cliente antigo" />
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-xs font-body">{errorMsg}</p>
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
