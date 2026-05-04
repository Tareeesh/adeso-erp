import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Plus, Briefcase } from 'lucide-react'

export default function PurchaseListPage() {
  const { data: prs = [] } = useQuery({ queryKey: ['purchase-requisitions'], queryFn: () => api.get('/operations/purchase/requisitions').then(r => r.data) })
  const { data: pos = [] } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => api.get('/operations/purchase/orders').then(r => r.data) })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2"><Briefcase size={24} className="text-primary-600" />Purchase Management</h1>
        <Link to="/operations/purchase/new" className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />New Requisition</Link>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-4 border-b border-secondary-100"><h2 className="font-semibold">Purchase Requisitions</h2></div>
          <div className="divide-y divide-secondary-100">
            {prs.map(pr => (
              <Link key={pr.id} to={`/documents/${pr.document_id}`} className="flex items-center justify-between p-3 hover:bg-secondary-50">
                <div><p className="text-sm font-medium">{pr.title}</p><p className="text-xs text-secondary-500">{pr.document_number}</p></div>
                <span className={`badge-${pr.status}`}>{pr.status}</span>
              </Link>
            ))}
            {prs.length === 0 && <p className="p-4 text-sm text-secondary-400 text-center">No requisitions</p>}
          </div>
        </div>
        <div className="card">
          <div className="p-4 border-b border-secondary-100"><h2 className="font-semibold">Purchase Orders (LPO)</h2></div>
          <div className="divide-y divide-secondary-100">
            {pos.map(po => (
              <Link key={po.id} to={`/documents/${po.document_id}`} className="flex items-center justify-between p-3 hover:bg-secondary-50">
                <div><p className="text-sm font-medium">{po.document_number} — {po.supplier_name}</p><p className="text-xs text-secondary-500">{po.currency} {po.total_amount?.toLocaleString()}</p></div>
                <span className={`badge-${po.status}`}>{po.status}</span>
              </Link>
            ))}
            {pos.length === 0 && <p className="p-4 text-sm text-secondary-400 text-center">No purchase orders</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
