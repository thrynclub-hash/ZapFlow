import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Copy, Check, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Creatives() {
  const { profile } = useAuth()
  const clientId = profile?.client_id
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copiedPath, setCopiedPath] = useState('')
  const fileRef = useRef()

  useEffect(() => { if (clientId) fetchFiles() }, [clientId])

  async function fetchFiles() {
    setLoading(true)
    const { data } = await supabase.storage.from('creatives').list(`biblioteca/${clientId}`, { sortBy: { column: 'created_at', order: 'desc' } })
    setFiles((data || []).filter(f => f.name !== '.emptyFolderPlaceholder'))
    setLoading(false)
  }

  function publicUrl(name) {
    return supabase.storage.from('creatives').getPublicUrl(`biblioteca/${clientId}/${name}`).data.publicUrl
  }

  async function handleUpload(e) {
    const uploadFiles = Array.from(e.target.files || [])
    if (uploadFiles.length === 0) return
    setUploading(true)
    for (const file of uploadFiles) {
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`
      await supabase.storage.from('creatives').upload(`biblioteca/${clientId}/${safeName}`, file, { upsert: true })
    }
    await fetchFiles()
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(name) {
    if (!confirm('Remover esta imagem? Se ela já estiver em uso numa campanha, a campanha fica sem imagem.')) return
    await supabase.storage.from('creatives').remove([`biblioteca/${clientId}/${name}`])
    fetchFiles()
  }

  function copyLink(name) {
    navigator.clipboard.writeText(publicUrl(name))
    setCopiedPath(name)
    setTimeout(() => setCopiedPath(''), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">Criativos</h1>
          <p className="text-muted text-sm font-body mt-1">Fotos e imagens pra usar nos disparos e campanhas</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
          <button onClick={() => fileRef.current.click()} disabled={uploading}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg px-4 py-2.5 rounded-lg text-sm font-display font-bold transition-colors">
            <Upload size={14} /> {uploading ? 'Enviando...' : 'Enviar imagens'}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted font-body">
          <strong className="text-white">Como usar:</strong> sobe a imagem aqui, clica em <strong className="text-white">Copiar link</strong> e cola no campo de imagem do disparo (em "Novo Disparo" ou ao editar uma campanha em rascunho no "Histórico").
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : files.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center">
          <ImageIcon size={40} className="text-muted mx-auto mb-4" />
          <p className="text-white font-body font-medium mb-1">Nenhuma imagem ainda</p>
          <p className="text-muted text-sm font-body">Envie as fotos que vai usar nas campanhas</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map(f => (
            <div key={f.name} className="bg-card border border-border rounded-xl overflow-hidden group relative">
              <img src={publicUrl(f.name)} alt={f.name} className="w-full h-36 object-cover" />
              <div className="p-2.5 flex items-center justify-between gap-2">
                <button onClick={() => copyLink(f.name)} className="flex items-center gap-1.5 text-xs font-body text-accent hover:underline">
                  {copiedPath === f.name ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar link</>}
                </button>
                <button onClick={() => handleDelete(f.name)} className="text-muted hover:text-red-400 transition-colors p-1"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
