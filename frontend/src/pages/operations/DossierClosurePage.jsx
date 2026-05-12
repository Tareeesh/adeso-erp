import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { FolderCheck, CheckSquare, Square, Save, Upload, Paperclip, CheckCircle } from 'lucide-react'

export default function DossierClosurePage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [checklist, setChecklist] = useState([])
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['dossier', poId],
    queryFn: () => api.get(`/operations/dossier/po/${poId}`).then(r => r.data),
  })

  const { data: atts = [], refetch: refetchAtts } = useQuery({
    queryKey: ['attachments', 'dossier_closure', data?.dossier?.id],
    queryFn: () => data?.dossier?.id
      ? api.get(`/attachments/dossier_closure/${data.dossier.id}`).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!data?.dossier?.id,
  })

  useEffect(() => {
    if (data) {
      setChecklist(data.dossier?.checklist_items || data.defaultChecklist)
      setNotes(data.dossier?.closure_notes || '')
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload) => data?.dossier
      ? api.put(`/operations/dossier/${data.dossier.id}`, payload)
      : api.post('/operations/dossier', { documentId: data.po.document_id, ...payload }),
    onSuccess: () => { toast.success('Dossier saved'); qc.invalidateQueries(['dossier', poId]) },
    onError: err => toast.error(err.response?.data?.error || 'Save failed'),
  })

  const toggleItem = (key) => {
    setChecklist(p => p.map(i => i.key === key ? { ...i, checked: !i.checked } : i))
  }

  const handleSave = () => saveMutation.mutate({ closureNotes: notes, checklistItems: checklist })

  const handleUpload = async (file) => {
    const dossierId = data?.dossier?.id
    if (!dossierId) {
      toast.error('Save the dossier first before uploading files')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/attachments/dossier_closure/${dossierId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('File uploaded')
      refetchAtts()
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (!data) return null

  const { po, dossier } = data
  const allChecked = checklist.every(i => i.checked)
  const checkedCount = checklist.filter(i => i.checked).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-secondary-900">Dossier Closure</h1>
        <p className="text-sm text-secondary-500 mt-0.5">
          {po.doc_title} · {po.document_number} · {po.supplier_name}
        </p>
      </div>

      {/* Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-secondary-700">Checklist Progress</span>
          <span className="text-sm font-semibold text-secondary-900">{checkedCount}/{checklist.length}</span>
        </div>
        <div className="w-full bg-secondary-100 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all"
            style={{ width: `${checklist.length ? (checkedCount / checklist.length) * 100 : 0}%` }}
          />
        </div>
        {allChecked && (
          <div className="flex items-center gap-2 mt-3 text-green-700 bg-green-50 rounded-lg p-2.5 text-sm">
            <CheckCircle size={15} /> All items complete — dossier is ready to close
          </div>
        )}
      </div>

      {/* Checklist */}
      <div className="card p-4 space-y-1">
        <h2 className="font-semibold text-secondary-900 mb-3">Procurement Dossier Checklist</h2>
        {checklist.map(item => (
          <button
            key={item.key}
            onClick={() => toggleItem(item.key)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary-50 text-left transition-colors"
          >
            {item.checked
              ? <CheckSquare size={18} className="text-primary-600 flex-shrink-0" />
              : <Square size={18} className="text-secondary-300 flex-shrink-0" />}
            <span className={`text-sm ${item.checked ? 'text-secondary-500 line-through' : 'text-secondary-800'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Notes */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-secondary-900">Closure Notes</h2>
        <textarea
          className="input text-sm"
          rows={3}
          placeholder="Any final notes, outstanding items, or observations for the record…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saveMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
            <Save size={14} /> {saveMutation.isPending ? 'Saving…' : 'Save Dossier'}
          </button>
        </div>
      </div>

      {/* File uploads */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-secondary-900">Dossier Documents</h2>
        <p className="text-xs text-secondary-400">Upload final signed documents, closure certificates, or any supplementary files for archiving</p>

        <label className="flex items-center gap-2 btn-secondary text-sm cursor-pointer w-fit">
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Document'}
          <input type="file" className="hidden" onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} disabled={uploading} />
        </label>

        {atts.length > 0 && (
          <div className="space-y-1">
            {atts.map(att => (
              <div key={att.id} className="flex items-center gap-2 text-sm text-secondary-700 bg-secondary-50 rounded px-3 py-2">
                <Paperclip size={13} className="text-secondary-400 flex-shrink-0" />
                <a href={att.download_url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:text-primary-600">{att.file_name}</a>
                <span className="text-xs text-secondary-400">{att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
