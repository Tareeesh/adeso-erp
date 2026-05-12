import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { BarChart2, CheckCircle, Clock, FileText, Plus } from 'lucide-react'

const statusBadge = (s) => {
  if (s === 'approved') return <span className="badge-completed">Approved</span>
  if (s === 'reviewed') return <span className="badge-progress">Under Review</span>
  return <span className="badge-draft">Draft</span>
}

export default function BidAnalysisListPage() {
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['bid-analyses'],
    queryFn: () => api.get('/operations/bid-analysis').then(r => r.data),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Bid Analysis</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Evaluate supplier quotes and select the winning bid</p>
        </div>
        <Link to="/operations/rfq" className="btn-secondary text-sm flex items-center gap-2">
          <FileText size={15} /> Go to RFQ List
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" /></div>
      ) : analyses.length === 0 ? (
        <div className="card p-10 text-center">
          <BarChart2 size={36} className="mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-500 font-medium">No bid analyses yet</p>
          <p className="text-secondary-400 text-sm mt-1">Open an RFQ and start a bid analysis once quotes are received</p>
        </div>
      ) : (
        <div className="space-y-2">
          {analyses.map(a => (
            <div key={a.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <BarChart2 size={20} className="text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-secondary-900 truncate">{a.rfq_title || a.rfq_number}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-secondary-400">
                    <span>{a.rfq_number}</span>
                    {a.recommended_supplier_name && <><span>·</span><span>Winner: {a.recommended_supplier_name}</span></>}
                    <span>·</span>
                    <span>{new Date(a.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusBadge(a.status)}
                <Link to={`/operations/bid-analysis/${a.rfq_id}`} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
                  {a.status === 'approved' ? <><CheckCircle size={12} /> View</> : <><Clock size={12} /> Continue</>}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
