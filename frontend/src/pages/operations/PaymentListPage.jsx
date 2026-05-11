import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { CreditCard, Plus, DollarSign } from 'lucide-react'

export default function PaymentListPage() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payment-requisitions'],
    queryFn: () => api.get('/operations/purchase/payments').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <CreditCard size={24} className="text-primary-600" />
          Payment Requisitions
        </h1>
        <Link to="/operations/payments/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />New Payment
        </Link>
      </div>

      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}
        {!isLoading && payments.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <CreditCard size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No payment requisitions yet</p>
            <p className="text-sm mt-1">Create a new payment requisition to get started</p>
          </div>
        )}
        {payments.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {payments.map(p => (
              <Link key={p.id} to={`/documents/${p.document_id}`} className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <DollarSign size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">{p.payee_name || p.title}</p>
                    <p className="text-xs text-secondary-500 mt-0.5">
                      {p.currency} {p.amount != null ? Number(p.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—'}
                      {p.payment_purpose ? ` · ${p.payment_purpose.slice(0, 50)}${p.payment_purpose.length > 50 ? '…' : ''}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`badge-${p.status}`}>{p.status}</span>
                  <p className="text-xs text-secondary-400 mt-1">{p.document_number}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
