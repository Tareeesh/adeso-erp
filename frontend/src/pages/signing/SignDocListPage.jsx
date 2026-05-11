import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Upload, FileText, CheckCircle, Clock, Send, Trash2, Plus } from 'lucide-react'

const statusBadge = (s, signed, total) => {
  if (s === 'completed') return <span className="badge-completed">Completed</span>
  if (s === 'sent') return <span className="badge-progress">{signed}/{total} Signed</span>
  return <span className="badge-draft">Draft</span>
}

export default function SignDocListPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['sign-docs'],
    queryFn: () => api.get('/sign-docs').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/sign-docs/${id}`),
    onSuccess: () => { toast.success('Document deleted'); qc.invalidateQueries(['sign-docs']) },
    onError: err => toast.error(err.response?.data?.error || 'Delete failed'),
  })

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return toast.error('Select a PDF file first')
    if (!title.trim()) return toast.error('Enter a document title')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim())
      const { data } = await api.post('/sign-docs', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document uploaded')
      qc.invalidateQueries(['sign-docs'])
      setShowUpload(false)
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      navigate(`/signing/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-secondary-900">Document Signing</h1>
            <p className="text-sm text-secondary-500 mt-0.5">Upload PDFs, place signature fields, and send for signing</p>
          </div>
          <button onClick={() => setShowUpload(v => !v)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Upload Document
          </button>
        </div>

        {showUpload && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
            <h3 className="font-semibold text-sm text-blue-900">Upload a PDF for Signing</h3>
            <div>
              <label className="label">Document Title *</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Service Agreement, MOU, Contract…" />
            </div>
            <div>
              <label className="label">PDF File *</label>
              <input ref={fileRef} type="file" accept=".pdf" className="block text-sm text-secondary-600" />
              <p className="text-xs text-secondary-400 mt-1">Only PDF files are supported. Max 50MB.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowUpload(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleUpload} disabled={uploading} className="btn-primary text-sm flex items-center gap-2">
                {uploading ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Uploading…</> : <><Upload size={14} /> Upload &amp; Place Fields</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" /></div>
      ) : docs.length === 0 ? (
        <div className="card p-10 text-center">
          <FileText size={36} className="mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-500 font-medium">No signing documents yet</p>
          <p className="text-secondary-400 text-sm mt-1">Upload a PDF to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText size={20} className="text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-secondary-900 truncate">{doc.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-secondary-400">
                    <span>{new Date(doc.created_at).toLocaleDateString('en-GB')}</span>
                    <span>·</span>
                    <span>{doc.recipient_count || 0} recipient{doc.recipient_count !== 1 ? 's' : ''}</span>
                    {doc.status === 'completed' && doc.completed_at && (
                      <><span>·</span><span>Completed {new Date(doc.completed_at).toLocaleDateString('en-GB')}</span></>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusBadge(doc.status, doc.signed_count, doc.recipient_count)}
                {doc.status === 'draft' && (
                  <Link to={`/signing/${doc.id}`} className="btn-primary text-xs flex items-center gap-1.5 py-1.5">
                    <Send size={12} /> Prepare &amp; Send
                  </Link>
                )}
                {doc.status === 'sent' && (
                  <Link to={`/signing/${doc.id}`} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
                    <Clock size={12} /> View Progress
                  </Link>
                )}
                {doc.status === 'completed' && (
                  <Link to={`/signing/${doc.id}`} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
                    <CheckCircle size={12} /> View Signed
                  </Link>
                )}
                {doc.status === 'draft' && (
                  <button
                    onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(doc.id) }}
                    className="p-1.5 text-secondary-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
