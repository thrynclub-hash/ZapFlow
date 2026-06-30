import { useEffect, useRef, useState } from 'react'
import { Upload, Plus, Search, Trash2, Download, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import * as XLSX from 'xlsx'

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
  const fileRef = useRef()

  const clientId = profile?.client_id

  useEffect(() => { if (clientId) { fetchContacts(); fetchNumbers() } }, [clientId])

  async function fetchNumbers() {
    const { data } = await supabase.from('client_numbers').select('*').eq('client_id', clientId).eq('active', true)
    setNumbers(data || [])
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

  async function handleImportCSV(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws)
        const toInsert = rows.map(r => ({
          client_id: clientId,
          number_id: numbers[0]?.id || null,
          name: String(r.Nome || r.nome || r.name || r.NOME || r.CONTATO || r.Contato || ''),
          phone: String(r.Número || r.numero || r.Numero || r.telefone || r.phone || r.Telefone || r.celular || r.Celular || r.TELEFONE || r.NUMERO || '').replace(/\D/g, ''),
          birth_date: r.nascimento || r.birth_date || r.aniversario || null,
          tags: [],
        })).filter(c => c.phone.length >= 8 && c.name)
        for (let i = 0; i < toInsert.length; i += 100) {
          await supabase.from('contacts').upsert(toInsert.slice(i, i + 100), { onConflict: 'client_id,phone' })
        }
        fetchContacts()
        const skipped = rows.length - toInsert.length
        alert(`✅ ${toInsert.length} contatos importados!${skipped > 0 ? ` (${skipped} ignorados por telefone inválido)` : ''}`)
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
        <div className="flex gap-3">
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
          <strong className="text-white">Como importar:</strong> Seu arquivo CSV/Excel deve ter colunas: <code className="text-accent">nome</code>, <code className="text-accent">telefone</code>, <code className="text-accent">nascimento</code> (opcional, formato DD/MM/AAAA).
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
                <th className="text-left px-5 py-3 text-xs text-muted font-body">Cadastrado</th>
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
                  <td className="px-5 py-3.5 text-sm text-muted font-body">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
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
        <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md animate-fadein my-auto">
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
        </div>
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
