import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Truck, CheckCircle, AlertTriangle, Clock } from 'lucide-react'

const statusBadge = (s) => {
  if (s === 'passed') return <span className="badge-completed">Passed</span>
  if (s === 'failed') return <span className="text-xs bg-red-100 text-red-700 rounded-full px-2.5 py-0.5 font-medium">Failed</span>
  if (s === 'partial') return <span className="badge-progress">Partial</span>
  return <span className="badge-draft">Pending</span>
}

export default function DeliveryListPage() {
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => api.get('/operations/delivery').then(r => r.data),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Delivery & Goods Receipt</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Record and inspect goods received against Purchase Orders</p>
        </div>
        <Link to="/operations/delivery/new" className="btn-primary text-sm flex items-center gap-2">
          <Truck size={15} /> Record Delivery
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" /></div>
      ) : deliveries.length === 0 ? (
        <div className="card p-10 text-center">
          <Truck size={36} className="mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-500 font-medium">No deliveries recorded yet</p>
          <p className="text-secondary-400 text-sm mt-1">Record a delivery when goods arrive against a Purchase Order</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map(d => (
            <div key={d.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Truck size={20} className="text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-secondary-900 truncate">{d.po_title || d.po_number}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-secondary-400">
                    <span>{d.po_number}</span>
                    <span>·</span>
                    <span>{d.supplier_name}</span>
                    <span>·</span>
                    <span>Received {new Date(d.received_date).toLocaleDateString('en-GB')}</span>
                    <span>·</span>
                    <span>By {d.inspected_by_name}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusBadge(d.inspection_status)}
                <Link to={`/operations/delivery/po/${d.po_id}`} className="btn-secondary text-xs py-1.5">View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
