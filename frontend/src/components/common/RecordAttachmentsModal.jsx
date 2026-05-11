import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Paperclip, X, Upload, Download, Trash2, FileText } from 'lucide-react'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function RecordAttachmentsModal({ isOpen, onClose, recordType, recordId, title }) {
  const qc = useQueryClient()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments', recordType, recordId],
    queryFn: () => api.get(`/attachments/${recordType}/${recordId}`).then(r => r.data),
    enabled: isOpen && !!recordId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/attachments/${id}`),
    onSuccess: () => {
      toast.success('Attachment removed')
      qc.invalidateQueries(['attachments', recordType, recordId])
    },
    onError: () => toast.error('Failed to remove attachment'),
  })

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/attachments/${recordType}/${recordId}`, fd)
      toast.success('File attached')
      qc.invalidateQueries(['attachments', recordType, recordId])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
          <div className="flex items-center gap-2">
            <Paperclip size={18} className="text-primary-600" />
            <div>
              <h3 className="font-semibold text-secondary-900 text-sm">Attachments</h3>
              {title && <p className="text-xs text-secondary-500 truncate max-w-xs">{title}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            </div>
          )}
          {!isLoading && attachments.length === 0 && (
            <div className="text-center py-8 text-secondary-400">
              <FileText size={32} className="mx-auto mb-2 text-secondary-200" />
              <p className="text-sm">No attachments yet</p>
            </div>
          )}
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
              <FileText size={15} className="text-secondary-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-900 truncate">{att.file_name}</p>
                <p className="text-xs text-secondary-400">
                  {new Date(att.created_at).toLocaleDateString('en-GB')}
                  {att.file_size ? ` · ${formatSize(att.file_size)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {att.download_url && (
                  <a
                    href={att.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded hover:bg-secondary-200 text-primary-600"
                    title="Download"
                  >
                    <Download size={14} />
                  </a>
                )}
                <button
                  onClick={() => deleteMutation.mutate(att.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded hover:bg-red-50 text-secondary-400 hover:text-red-500"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-secondary-100">
          <label className={`w-full btn-primary flex items-center justify-center gap-2 text-sm cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload size={15} />
            {uploading ? 'Uploading…' : 'Attach PDF or Word Document'}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              disabled={uploading}
              onChange={e => handleUpload(e.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-secondary-400 text-center mt-2">PDF and Word documents only · Max 50 MB</p>
        </div>
      </div>
    </div>
  )
}
