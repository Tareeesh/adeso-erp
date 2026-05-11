import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { ShoppingCart, Plus } from 'lucide-react'

export default function PurchaseOrderListPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get('/operations/purchase/orders').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <ShoppingCart size={24} className="text-primary-600" /> Purchase Orders / LPO
        </h1>
      </div>

      <div className="card">
        {isLoading && <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></div>}
        {!isLoading && orders.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <ShoppingCart size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No purchase orders yet</p>
            <p className="text-sm mt-1">POs are created after bid analysis is completed</p>
          </div>
        )}
        {orders.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {orders.map(o => (
              <Link key={o.id} to={`/documents/${o.document_id}`} className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><ShoppingCart size={18} className="text-green-600" /></div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">{o.document_number}</p>
                    <p className="text-xs text-secondary-500 mt-0.5">
                      {o.supplier_name || 'No supplier'} · {o.currency} {Number(o.total_amount || 0).toLocaleString('en-GB')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`badge-${o.status}`}>{o.status}</span>
                  <p className="text-xs text-secondary-400 mt-1">{o.delivery_status || 'pending delivery'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
