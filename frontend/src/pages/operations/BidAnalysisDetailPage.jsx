import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { CheckCircle, Save, Send, Award, AlertTriangle, ChevronDown, ChevronUp, Paperclip, Upload, Trash2 } from 'lucide-react'

const fmt = (n, cur = 'KES') => n != null ? `${cur} ${Number(n).toLocaleString()}` : '—'

export default function BidAnalysisDetailPage() {
  const { rfqId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [committeeNotes, setCommitteeNotes] = useState('')
  const [recommendedQuoteId, setRecommendedQuoteId] = useState('')
  const [overrideJustification, setOverrideJustification] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['bid-analysis', rfqId],
    queryFn: () => api.get(`/operations/bid-analysis/rfq/${rfqId}`).then(r => r.data),
  })

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ['attachments', 'bid_analysis', data?.analysis?.id],
    queryFn: () => data?.analysis?.id
      ? api.get(`/attachments/bid_analysis/${data.analysis.id}`).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!data?.analysis?.id,
  })

  useEffect(() => {
    if (data?.analysis) {
      setCommitteeNotes(data.analysis.committee_notes || '')
      setRecommendedQuoteId(data.analysis.recommended_quote_id || '')
      setOverrideJustification(data.analysis.override_justification || '')
    }
  }, [data?.analysis])

  const saveMutation = useMutation({
    mutationFn: (payload) => data?.analysis
      ? api.put(`/operations/bid-analysis/${data.analysis.id}`, payload)
      : api.post('/operations/bid-analysis', { rfqId, ...payload }),
    onSuccess: () => { toast.success('Bid analysis saved'); qc.invalidateQueries(['bid-analysis', rfqId]) },
    onError: err => toast.error(err.response?.data?.error || 'Save failed'),
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/operations/bid-analysis/${data.analysis.id}/submit`),
    onSuccess: () => { toast.success('Submitted for review'); qc.invalidateQueries(['bid-analysis', rfqId]) },
    onError: err => toast.error(err.response?.data?.error || 'Submit failed'),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/operations/bid-analysis/${data.analysis.id}/approve`),
    onSuccess: () => { toast.success('Bid analysis approved'); qc.invalidateQueries(['bid-analysis', rfqId]) },
    onError: err => toast.error(err.response?.data?.error || 'Approve failed'),
  })

  const handleSave = () => {
    const recQuote = data?.quotes?.find(q => q.id === recommendedQuoteId)
    saveMutation.mutate({
      recommendedQuoteId: recommendedQuoteId || null,
      recommendedSupplierId: recQuote?.supplier_id || null,
      overrideJustification: overrideJustification || null,
      committeeNotes,
    })
  }

  const handleUpload = async (file, category) => {
    if (!data?.analysis?.id) return toast.error('Save the analysis first before uploading')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      await api.post(`/attachments/bid_analysis/${data.analysis.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('File uploaded')
      refetchAttachments()
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (!data) return null

  const { rfq, quotes, analysis } = data
  const isApproved = analysis?.status === 'approved'
  const currency = rfq.currency || 'KES'
  const lowestQuote = quotes.length ? quotes[0] : null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Bid Analysis</h1>
          <p className="text-sm text-secondary-500 mt-0.5">{rfq.doc_title} · {rfq.document_number}</p>
          {rfq.department && <p className="text-xs text-secondary-400 mt-0.5">Department: {rfq.department} · Budget Line: {rfq.budget_line}</p>}
        </div>
        <div className="flex items-center gap-2">
          {analysis?.status === 'approved' && <span className="badge-completed flex items-center gap-1"><CheckCircle size={12} /> Approved</span>}
          {analysis?.status === 'reviewed' && <span className="badge-progress">Under Review</span>}
          {!analysis?.status && <span className="badge-draft">New</span>}
          {analysis?.status === 'draft' && <span className="badge-draft">Draft</span>}
        </div>
      </div>

      {/* Quotes comparison table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-secondary-100">
          <h2 className="font-semibold text-secondary-900">Received Quotations ({quotes.length})</h2>
          <p className="text-xs text-secondary-400 mt-0.5">Prices sorted lowest to highest</p>
        </div>
        {quotes.length === 0 ? (
          <div className="p-8 text-center text-secondary-400">No quotes received for this RFQ yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Supplier</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Total Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Delivery Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Payment Terms</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {quotes.map((q, i) => {
                  const isRec = q.id === recommendedQuoteId
                  const isLowest = i === 0
                  return (
                    <tr key={q.id} className={isRec ? 'bg-primary-50' : 'hover:bg-secondary-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-secondary-900">{q.display_name || q.supplier_name}</span>
                          {isLowest && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">Lowest</span>}
                          {isRec && <span className="text-xs bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 flex items-center gap-1"><Award size={10} /> Selected</span>}
                        </div>
                        <p className="text-xs text-secondary-400 mt-0.5">{q.supplier_email}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-secondary-900">{fmt(q.total_amount, q.currency || currency)}</td>
                      <td className="px-4 py-3 text-right text-secondary-600">{q.delivery_days ? `${q.delivery_days} days` : '—'}</td>
                      <td className="px-4 py-3 text-secondary-600 text-xs max-w-[150px] truncate">{q.payment_terms || '—'}</td>
                      <td className="px-4 py-3 text-secondary-500 text-xs max-w-[150px] truncate">{q.notes || '—'}</td>
                      <td className="px-4 py-3">
                        {!isApproved && (
                          <button
                            onClick={() => setRecommendedQuoteId(isRec ? '' : q.id)}
                            className={isRec ? 'btn-primary text-xs py-1 px-2.5' : 'btn-secondary text-xs py-1 px-2.5'}
                          >
                            {isRec ? 'Deselect' : 'Select'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Override / committee notes */}
      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-secondary-900">Evaluation Notes</h2>

        <div>
          <label className="label">Committee Notes</label>
          <textarea
            className="input text-sm"
            rows={3}
            placeholder="Summarise the evaluation committee's findings and rationale for the selection…"
            value={committeeNotes}
            onChange={e => setCommitteeNotes(e.target.value)}
            disabled={isApproved}
          />
        </div>

        <button
          className="text-xs text-secondary-500 flex items-center gap-1 hover:text-secondary-700"
          onClick={() => setShowOverride(v => !v)}
        >
          {showOverride ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Override / Exception justification
        </button>

        {showOverride && (
          <div>
            <label className="label">Override Justification <span className="text-secondary-400 font-normal">(if not selecting lowest bid)</span></label>
            <textarea
              className="input text-sm"
              rows={2}
              placeholder="Provide justification if the recommended supplier is not the lowest bidder…"
              value={overrideJustification}
              onChange={e => setOverrideJustification(e.target.value)}
              disabled={isApproved}
            />
          </div>
        )}

        {!isApproved && (
          <div className="flex gap-2 justify-end">
            <button onClick={handleSave} disabled={saveMutation.isPending} className="btn-secondary text-sm flex items-center gap-2">
              <Save size={14} /> {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
            </button>
            {analysis?.status === 'draft' && (
              <button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
                <Send size={14} /> Submit for Review
              </button>
            )}
            {analysis?.status === 'reviewed' && (
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="btn-primary text-sm flex items-center gap-2">
                <CheckCircle size={14} /> Approve
              </button>
            )}
          </div>
        )}
        {isApproved && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3 text-sm">
            <CheckCircle size={16} />
            <span>This bid analysis has been approved. Winner: <strong>{analysis.recommended_supplier_name || '—'}</strong></span>
          </div>
        )}
      </div>

      {/* Supporting documents */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-secondary-900">Supporting Documents</h2>
        <p className="text-xs text-secondary-400">Upload quote documents, technical evaluation sheets, or committee minutes</p>

        {!isApproved && (
          <label className="flex items-center gap-2 btn-secondary text-sm cursor-pointer w-fit">
            <Upload size={14} />
            {uploading ? 'Uploading…' : 'Upload Document'}
            <input type="file" className="hidden" onChange={e => e.target.files[0] && handleUpload(e.target.files[0], 'bid_doc')} disabled={uploading} />
          </label>
        )}

        {attachments.length > 0 && (
          <div className="space-y-1 mt-2">
            {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-3 text-sm text-secondary-700 bg-secondary-50 rounded-lg px-3 py-2">
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
