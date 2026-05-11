import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import WorkflowTracker from '../../components/common/WorkflowTracker'
import SignatureModal from '../../components/signatures/SignatureModal'
import DocumentBodyRenderer from '../../components/documents/DocumentBodyRenderer'
import { toast } from 'react-toastify'
import { FileText, Download, Upload, CheckCircle, XCircle, Paperclip, MessageSquare, ArrowRight, FileSearch, ShoppingCart, Edit2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getProcurementTier, getTierColorClass } from '../../utils/procurementThresholds'

const statusBadge = (status) => {
  const map = { draft: 'badge-draft', pending: 'badge-pending', in_progress: 'badge-progress', completed: 'badge-completed', rejected: 'badge-rejected', approved: 'badge-approved' }
  return <span className={map[status] || 'badge-draft'}>{status?.replace(/_/g, ' ').toUpperCase()}</span>
}

export default function DocumentDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showSignModal, setShowSignModal] = useState(false)
  const [activeStep, setActiveStep] = useState(null)
  const [comment, setComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [uploading, setUploading] = useState(false)

  const uploadAttachment = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/workflows/${id}/attachments`, fd)
      toast.success('File attached')
      qc.invalidateQueries(['document', id])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const { data: doc, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => api.get(`/workflows/${id}`).then(r => r.data),
  })

  const { data: record } = useQuery({
    queryKey: ['document-record', id],
    queryFn: () => api.get(`/workflows/${id}/record`).then(r => r.data),
    enabled: !!id && !!doc,
  })

  const myStep = doc?.steps?.find(s => s.assigned_user_id === user?.id && s.status === 'in_progress')

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/workflows/${id}/submit`),
    onSuccess: () => { toast.success('Document submitted for approval'); qc.invalidateQueries(['document', id]) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to submit'),
  })

  const approveMutation = useMutation({
    mutationFn: ({ stepId, comments }) => api.post(`/workflows/${id}/steps/${stepId}/approve`, { comments }),
    onSuccess: () => { toast.success('Step approved'); qc.invalidateQueries(['document', id]); setShowSignModal(false) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ stepId, comments }) => api.post(`/workflows/${id}/steps/${stepId}/reject`, { comments }),
    onSuccess: () => { toast.success('Document rejected'); qc.invalidateQueries(['document', id]); setShowRejectBox(false) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to reject'),
  })

  const signMutation = useMutation({
    mutationFn: ({ stepId, ...data }) => api.post(`/signatures/${id}/sign/${stepId}`, data),
    onSuccess: () => { toast.success('Document signed'); qc.invalidateQueries(['document', id]); setShowSignModal(false) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to sign'),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/workflows/${id}/comments`, { comment }),
    onSuccess: () => { toast.success('Comment added'); qc.invalidateQueries(['document', id]); setComment('') },
  })

  const downloadPDF = async () => {
    const { data } = await api.get(`/workflows/${id}/pdf`)
    window.open(data.url, '_blank')
  }

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (!doc) return <div className="card p-8 text-center text-secondary-500">Document not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-secondary-500">{doc.document_number}</span>
              {statusBadge(doc.status)}
            </div>
            <h1 className="text-xl font-bold text-secondary-900">{doc.title}</h1>
            <p className="text-sm text-secondary-500 mt-1">
              Created by {doc.created_by_name || 'Unknown'} · {new Date(doc.created_at).toLocaleDateString('en-GB')}
            </p>
          </div>
          <button onClick={downloadPDF} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} />Export PDF
          </button>
        </div>

        {doc.rejection_reason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Rejected:</strong> {doc.rejection_reason}
          </div>
        )}

        {/* Workflow tracker */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-secondary-700 mb-3">Approval Progress</h3>
          <WorkflowTracker steps={doc.steps || []} />
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-3 flex-wrap">
          {doc.status === 'draft' && doc.created_by === user?.id && (
            <>
              {doc.document_type === 'purchase_requisition' && (
                <Link to={`/operations/purchase/edit/${doc.id}`} className="btn-secondary text-sm flex items-center gap-2">
                  <Edit2 size={14} />Edit Draft
                </Link>
              )}
              <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="btn-primary text-sm">
                Submit for Approval
              </button>
            </>
          )}

          {myStep && myStep.step_type === 'signature' && (
            <button onClick={() => { setActiveStep(myStep); setShowSignModal(true) }} className="btn-primary text-sm flex items-center gap-2">
              <FileText size={14} />Sign Document
            </button>
          )}

          {myStep && myStep.step_type === 'approval' && !showRejectBox && (
            <>
              <button onClick={() => approveMutation.mutate({ stepId: myStep.id })} disabled={approveMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
                <CheckCircle size={14} />Approve
              </button>
              <button onClick={() => setShowRejectBox(true)} className="btn-danger text-sm flex items-center gap-2">
                <XCircle size={14} />Reject
              </button>
            </>
          )}
        </div>

        {showRejectBox && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
            <label className="label text-red-700">Rejection Reason (required)</label>
            <textarea className="input" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." />
            <div className="flex gap-2">
              <button onClick={() => setShowRejectBox(false)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => rejectMutation.mutate({ stepId: myStep.id, comments: rejectReason })}
                disabled={!rejectReason || rejectMutation.isPending}
                className="btn-danger text-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document body — formatted view for all document types */}
      {record !== undefined && <DocumentBodyRenderer doc={doc} record={record} />}

      {/* Procurement next steps — shown when a PR is completed */}
      {doc.document_type === 'purchase_requisition' && doc.status === 'completed' && (() => {
        const amount = doc.metadata?.estimatedTotal || doc.metadata?.estimated_total || 0
        const currency = doc.metadata?.currency || 'KES'
        const tier = getProcurementTier(Number(amount), currency)
        return (
          <div className={`rounded-xl border p-5 space-y-4 ${getTierColorClass(tier.color)}`}>
            <div>
              <h3 className="font-semibold text-sm">Procurement Next Steps — {tier.label}</h3>
              {tier.solicitation !== 'Not required' && (
                <p className="text-xs mt-1 opacity-80">{tier.solicitation}</p>
              )}
              {tier.committee && (
                <p className="text-xs mt-0.5 opacity-80">Procurement Committee: minimum {tier.committee.members} members required</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tier.tier >= 2 && (
                <Link to={`/operations/rfq/new?prId=${doc.id}`} className="flex items-center gap-1.5 bg-white bg-opacity-70 hover:bg-opacity-90 rounded-lg px-3 py-2 text-sm font-medium transition-colors">
                  <FileSearch size={14} /> Create RFQ <ArrowRight size={12} />
                </Link>
              )}
              {tier.tier >= 2 && (
                <Link to="/operations/orders" className="flex items-center gap-1.5 bg-white bg-opacity-70 hover:bg-opacity-90 rounded-lg px-3 py-2 text-sm font-medium transition-colors">
                  <ShoppingCart size={14} /> View Purchase Orders <ArrowRight size={12} />
                </Link>
              )}
              {tier.tier < 2 && (
                <span className="text-sm opacity-75">No formal solicitation required. Attach receipt to close this requisition.</span>
              )}
            </div>
          </div>
        )
      })()}

      {/* Attachments */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-secondary-900 flex items-center gap-2">
            <Paperclip size={16} />
            Attachments{doc.attachments?.length > 0 ? ` (${doc.attachments.length})` : ''}
          </h3>
          <label className={`btn-secondary text-sm flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload size={13} />
            {uploading ? 'Uploading…' : 'Attach File'}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              disabled={uploading}
              onChange={e => { uploadAttachment(e.target.files?.[0]); e.target.value = '' }}
            />
          </label>
        </div>
        {(!doc.attachments || doc.attachments.length === 0) && (
          <p className="text-sm text-secondary-400">No attachments yet. Attach a PDF or Word document.</p>
        )}
        <div className="space-y-2">
          {doc.attachments?.map(att => (
            <div key={att.id} className="flex items-center justify-between p-2 bg-secondary-50 rounded-lg">
              <span className="text-sm text-secondary-700 flex items-center gap-2">
                <FileText size={13} className="text-secondary-400 flex-shrink-0" />
                {att.file_name}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-secondary-400">{new Date(att.created_at).toLocaleDateString('en-GB')}</span>
                {att.download_url && (
                  <a href={att.download_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                    <Download size={12} />Download
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-secondary-400 mt-3">PDF and Word documents only · Max 50 MB</p>
      </div>

      {/* Comments */}
      <div className="card p-4">
        <h3 className="font-medium text-secondary-900 mb-3 flex items-center gap-2"><MessageSquare size={16} />Comments</h3>
        <div className="space-y-3 mb-4">
          {doc.comments?.length === 0 && <p className="text-sm text-secondary-400">No comments yet</p>}
          {doc.comments?.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold flex-shrink-0">
                {c.first_name?.[0]}{c.last_name?.[0]}
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-700">{c.first_name} {c.last_name} <span className="text-secondary-400 font-normal">· {new Date(c.created_at).toLocaleString('en-GB')}</span></p>
                <p className="text-sm text-secondary-600 mt-0.5">{c.comment}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." />
          <button onClick={() => commentMutation.mutate()} disabled={!comment || commentMutation.isPending} className="btn-primary text-sm">Post</button>
        </div>
      </div>

      {showSignModal && activeStep && (
        <SignatureModal
          onSign={({ signatureData, signatureType, typedName, comments }) => signMutation.mutate({ stepId: activeStep.id, signatureData, signatureType, typedName, comments })}
          onClose={() => setShowSignModal(false)}
          loading={signMutation.isPending}
        />
      )}
    </div>
  )
}
