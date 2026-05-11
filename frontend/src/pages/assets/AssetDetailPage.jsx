import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Package, ArrowLeft, Tag, MapPin, User, Wrench, History, Paperclip, Upload, Download, Trash2, FileText } from 'lucide-react'

const CONDITION_COLOR = {
  new: 'bg-emerald-50 text-emerald-700',
  good: 'bg-green-50 text-green-700',
  fair: 'bg-yellow-50 text-yellow-700',
  poor: 'bg-orange-50 text-orange-700',
  damaged: 'bg-red-50 text-red-700',
  disposed: 'bg-secondary-100 text-secondary-500',
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-secondary-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-secondary-900 mt-0.5">{value || '—'}</p>
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AssetDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.get(`/assets/${id}`).then(r => r.data),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
      </div>
    )
  }

  if (error || !asset) {
    return (
      <div className="space-y-4">
        <Link to="/assets" className="flex items-center gap-2 text-sm text-secondary-500 hover:text-secondary-700">
          <ArrowLeft size={14} />Back to Assets
        </Link>
        <div className="card p-12 text-center text-secondary-400">
          <Package size={36} className="mx-auto mb-3 text-secondary-200" />
          <p className="font-medium">Asset not found</p>
        </div>
      </div>
    )
  }

  const assignments = asset.assignments || []
  const maintenance = asset.maintenance || []

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', 'asset', id],
    queryFn: () => api.get(`/attachments/asset/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const deleteAttachment = useMutation({
    mutationFn: (attId) => api.delete(`/attachments/${attId}`),
    onSuccess: () => { toast.success('Attachment removed'); qc.invalidateQueries(['attachments', 'asset', id]) },
    onError: () => toast.error('Failed to remove attachment'),
  })

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/attachments/asset/${id}`, fd)
      toast.success('File attached')
      qc.invalidateQueries(['attachments', 'asset', id])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/assets" className="flex items-center gap-2 text-sm text-secondary-500 hover:text-secondary-700">
          <ArrowLeft size={14} />Back
        </Link>
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <Package size={22} className="text-primary-600" />
          {asset.name}
        </h1>
        {asset.condition && (
          <span className={`text-xs rounded px-2 py-1 capitalize font-medium ${CONDITION_COLOR[asset.condition] || 'bg-secondary-100 text-secondary-600'}`}>
            {asset.condition}
          </span>
        )}
        <span className={`badge-${asset.status}`}>{asset.status}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Core Details */}
        <div className="card p-6 space-y-4 md:col-span-2">
          <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
            <Tag size={16} className="text-secondary-400" />Asset Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Asset ID" value={asset.asset_id_code} />
            <DetailItem label="Category" value={asset.category_name} />
            <DetailItem label="Brand" value={asset.brand} />
            <DetailItem label="Model" value={asset.model} />
            <DetailItem label="Serial Number" value={asset.serial_number} />
            <DetailItem label="Purchase Date" value={asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('en-GB') : null} />
            <DetailItem
              label="Purchase Cost"
              value={asset.purchase_cost != null ? `${asset.currency || ''} ${Number(asset.purchase_cost).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : null}
            />
            <DetailItem label="Warranty Expiry" value={asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString('en-GB') : null} />
          </div>
          {asset.notes && (
            <div>
              <p className="text-xs font-medium text-secondary-400 uppercase tracking-wide">Notes</p>
              <p className="text-sm text-secondary-700 mt-1">{asset.notes}</p>
            </div>
          )}
        </div>

        {/* Location & Assignment */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
              <MapPin size={16} className="text-secondary-400" />Location
            </h2>
            <DetailItem label="Office" value={asset.office_location} />
            <DetailItem label="Department" value={asset.department_name} />
          </div>
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
              <User size={16} className="text-secondary-400" />Assignment
            </h2>
            <DetailItem label="Assigned To" value={asset.assigned_to_name} />
          </div>
          {asset.qr_code_url && (
            <div className="card p-5 text-center">
              <p className="text-xs text-secondary-400 mb-2 uppercase tracking-wide">QR Code</p>
              <img src={asset.qr_code_url} alt="QR Code" className="w-28 h-28 mx-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Assignment History */}
      <div className="card">
        <div className="p-4 border-b border-secondary-100 flex items-center gap-2">
          <History size={16} className="text-secondary-400" />
          <h2 className="font-semibold text-secondary-900">Assignment History</h2>
        </div>
        {assignments.length === 0 ? (
          <div className="p-8 text-center text-secondary-400 text-sm">No assignment history</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-secondary-400 uppercase tracking-wide border-b border-secondary-100">
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Assigned</th>
                  <th className="text-left px-4 py-3">Returned</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {assignments.map((a, i) => (
                  <tr key={i} className="hover:bg-secondary-50">
                    <td className="px-4 py-3 text-secondary-900">{a.employee_name || '—'}</td>
                    <td className="px-4 py-3 text-secondary-600">
                      {a.assigned_date ? new Date(a.assigned_date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-secondary-600">
                      {a.return_date ? new Date(a.return_date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge-${a.status}`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Maintenance History */}
      <div className="card">
        <div className="p-4 border-b border-secondary-100 flex items-center gap-2">
          <Wrench size={16} className="text-secondary-400" />
          <h2 className="font-semibold text-secondary-900">Maintenance History</h2>
        </div>
        {maintenance.length === 0 ? (
          <div className="p-8 text-center text-secondary-400 text-sm">No maintenance records</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-secondary-400 uppercase tracking-wide border-b border-secondary-100">
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Scheduled</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {maintenance.map((m, i) => (
                  <tr key={i} className="hover:bg-secondary-50">
                    <td className="px-4 py-3 text-secondary-900">{m.description || '—'}</td>
                    <td className="px-4 py-3 text-secondary-600">
                      {m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge-${m.status}`}>{m.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
            <Paperclip size={16} className="text-secondary-400" />
            Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}
          </h2>
          <label className={`btn-secondary text-sm flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload size={13} />
            {uploading ? 'Uploading…' : 'Attach File'}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              disabled={uploading}
              onChange={e => handleUpload(e.target.files?.[0])}
            />
          </label>
        </div>
        {attachments.length === 0 && (
          <p className="text-sm text-secondary-400">No attachments yet. Attach a PDF or Word document.</p>
        )}
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-2 bg-secondary-50 rounded-lg">
              <FileText size={14} className="text-secondary-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-secondary-900 truncate">{att.file_name}</p>
                <p className="text-xs text-secondary-400">
                  {new Date(att.created_at).toLocaleDateString('en-GB')}
                  {att.file_size ? ` · ${formatSize(att.file_size)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {att.download_url && (
                  <a href={att.download_url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-secondary-200 text-primary-600" title="Download">
                    <Download size={14} />
                  </a>
                )}
                <button
                  onClick={() => deleteAttachment.mutate(att.id)}
                  disabled={deleteAttachment.isPending}
                  className="p-1.5 rounded hover:bg-red-50 text-secondary-400 hover:text-red-500"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-secondary-400 mt-3">PDF and Word documents only · Max 50 MB</p>
      </div>
    </div>
  )
}
