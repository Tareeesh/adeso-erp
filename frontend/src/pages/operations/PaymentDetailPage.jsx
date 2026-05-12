import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { CreditCard, Upload, Paperclip, Download, Trash2, FileText, Receipt, Truck, Shield, Search, ArrowLeft } from 'lucide-react'

const DOC_CATEGORIES = [
  { key: 'invoice', label: 'Invoice', icon: Receipt, description: 'Supplier invoice for this payment' },
  { key: 'delivery_note', label: 'Delivery Note / GRN', icon: Truck, description: 'Signed delivery note or goods received note' },
  { key: 'withholding_tax', label: 'Withholding Tax Certificate', icon: Shield, description: 'WHT certificate from supplier' },
  { key: 'sam_check', label: 'SAM / Vendor Screening', icon: Search, description: 'Vendor screening or SAM check result' },
]

function AttachmentSection({ category, recordId }) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['attachments', 'payment_requisitions', recordId],
    queryFn: () => api.get(`/attachments/payment_requisitions/${recordId}`).then(r => r.data),
    enabled: !!recordId,
  })

  const attachments = all.filter(a => (a.category || 'invoice') === category.key)

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category.key)
      await api.post(`/attachments/payment_requisitions/${recordId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(`${category.label} uploaded`)
      qc.invalidateQueries(['attachments', 'payment_requisitions', recordId])
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const handleDelete = async (attId) => {
    try {
      await api.delete(`/attachments/${attId}`)
      qc.invalidateQueries(['attachments', 'payment_requisitions', recordId])
    } catch { toast.error('Delete failed') }
  }

  const Icon = category.icon

  return (
    <div className="border border-secondary-200 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-primary-600" />
          <div>
            <p className="font-medium text-secondary-800 text-sm">{category.label}</p>
            <p className="text-xs text-secondary-400">{category.description}</p>
          </div>
        </div>
        <label className={`btn-secondary text-xs flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} disabled={uploading} />
        </label>
      </div>
      {isLoading && <div className="h-4 bg-secondary-100 rounded animate-pulse" />}
      {!isLoading && attachments.length === 0 && (
        <p className="text-xs text-secondary-400 py-1">No {category.label.toLowerCase()} uploaded yet</p>
      )}
      {attachments.map(att => (
        <div key={att.id} className="flex items-center gap-2 bg-secondary-50 rounded px-3 py-2">
          <FileText size={13} className="text-secondary-400 flex-shrink-0" />
          <span className="flex-1 text-sm text-secondary-700 truncate">{att.file_name}</span>
          <span className="text-xs text-secondary-400 flex-shrink-0">{att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ''}</span>
          {att.download_url && (
            <a href={att.download_url} target="_blank" rel="noreferrer"
              className="p-1 rounded hover:bg-secondary-200 text-primary-600" title="Download"><Download size={13} /></a>
          )}
          <button onClick={() => handleDelete(att.id)}
            className="p-1 rounded hover:bg-red-50 text-secondary-400 hover:text-red-500" title="Remove"><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  )
}

export default function PaymentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api.get(`/operations/purchase/payments/by-document/${id}`).then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  )
  if (!payment) return <div className="max-w-3xl mx-auto text-center py-20 text-secondary-400">Payment not found</div>

  const fmt = (n, cur) => n != null
    ? `${cur || payment.currency || 'KES'} ${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
    : '—'

  const row = (label, value) => value ? (
    <div>
      <p className="text-xs text-secondary-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-secondary-800 mt-0.5 text-sm">{value}</p>
    </div>
  ) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Payment Requisition</h1>
          <p className="text-sm text-secondary-500">{payment.document_number}</p>
        </div>
        <span className={`ml-auto badge-${payment.status || 'draft'}`}>{payment.status || 'draft'}</span>
      </div>

      {/* Payment Summary */}
      <div className="card p-5 space-y-5">
        <h2 className="font-semibold text-secondary-800 flex items-center gap-2 text-sm uppercase tracking-wide">
          <CreditCard size={15} className="text-primary-600" /> Payment Details
        </h2>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          {row('Payee', payment.payee_name)}
          {row('Paying Office', payment.paying_office)}
          {row('Bank', payment.payee_bank)}
          {row('Account Number', payment.payee_account)}
        </div>

        <hr className="border-secondary-100" />

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="text-xs text-secondary-400 uppercase tracking-wide font-medium">Amount</p>
            <p className="text-secondary-900 font-bold text-lg mt-0.5">{fmt(payment.amount)}</p>
          </div>
          {row('Mode of Payment', payment.payment_method?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()))}
        </div>

        {payment.amount_in_words && (
          <div className="bg-secondary-50 rounded-lg px-4 py-3">
            <p className="text-xs text-secondary-400 uppercase tracking-wide font-medium mb-0.5">Amount in Words</p>
            <p className="text-sm text-secondary-800 font-medium">{payment.amount_in_words}</p>
          </div>
        )}

        <hr className="border-secondary-100" />

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          {row('Reason for Payment', payment.payment_purpose)}
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 text-sm">
          {row('Budget Line', payment.budget_line)}
          {row('Budget Code', payment.budget_code)}
          {row('Project Code', payment.project_code)}
        </div>
      </div>

      {/* Supporting Documents */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-secondary-900">Supporting Documents</h2>
          <p className="text-xs text-secondary-400 mt-0.5">Upload all required documents before final approval</p>
        </div>
        {DOC_CATEGORIES.map(cat => (
          <AttachmentSection key={cat.key} category={cat} recordId={payment.id} />
        ))}
      </div>

      <div className="flex justify-end">
        <Link to={`/documents/${id}`} className="btn-primary text-sm">
          View Approval Workflow →
        </Link>
      </div>
    </div>
  )
}
