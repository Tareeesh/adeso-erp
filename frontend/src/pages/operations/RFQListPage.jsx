import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { FileSearch, Plus, Calendar, Users } from 'lucide-react'

export default function RFQListPage() {
  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ['rfqs'],
    queryFn: () => api.get('/operations/purchase/rfq').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <FileSearch size={24} className="text-primary-600" /> Requests for Quotation
        </h1>
        <Link to="/operations/rfq/new" className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />New RFQ</Link>
      </div>

      <div className="card">
        {isLoading && <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></div>}
        {!isLoading && rfqs.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <FileSearch size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No RFQs yet</p>
            <p className="text-sm mt-1">Create an RFQ after a purchase requisition is approved</p>
          </div>
        )}
        {rfqs.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {rfqs.map(r => (
              <Link key={r.id} to={`/documents/${r.document_id}`} className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><FileSearch size={18} className="text-purple-600" /></div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">{r.document_number}</p>
                    <p className="text-xs text-secondary-500 flex items-center gap-2 mt-0.5">
                      {r.deadline && <><Calendar size={11} /> Deadline: {new Date(r.deadline).toLocaleDateString('en-GB')}</>}
                      <><Users size={11} /> {r.quote_count || 0} quotes</>
                    </p>
                  </div>
                </div>
                <span className={`badge-${r.status}`}>{r.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
