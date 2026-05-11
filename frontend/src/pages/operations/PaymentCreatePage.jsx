import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { CreditCard, Lock, Users } from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cash', label: 'Cash' },
  { value: 'petty_cash', label: 'Petty Cash' },
]

const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'ETB', 'SOS']

export default function PaymentCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const poId = searchParams.get('poId')

  const [form, setForm] = useState({
    payeeName: '',
    payeeAccount: '',
    payeeBank: '',
    currency: 'KES',
    amount: '',
    paymentMethod: 'bank_transfer',
    paymentPurpose: '',
    budgetLine: '',
  })
  const [budgetHolderId, setBudgetHolderId] = useState('')
  const [financeId, setFinanceId] = useState('')
  const [ccUsers, setCcUsers] = useState([])

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const { data: poData } = useQuery({
    queryKey: ['po', poId],
    queryFn: () => api.get(`/operations/purchase/orders/${poId}`).then(r => r.data),
    enabled: !!poId,
  })

  useEffect(() => {
    if (poData) {
      setForm(p => ({
        ...p,
        payeeName: p.payeeName || poData.supplier_name || poData.supplier_name_resolved || '',
      }))
    }
  }, [poData])

  const mutation = useMutation({
    mutationFn: (data) => api.post('/operations/purchase/payments', data),
    onSuccess: ({ data }) => {
      toast.success('Payment requisition created')
      navigate(`/documents/${data.document.id}`)
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create'),
  })

  const setField = (field, val) => setForm(p => ({ ...p, [field]: val }))

  const toggleCc = (userId) => {
    setCcUsers(p => p.includes(userId) ? p.filter(id => id !== userId) : [...p, userId])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!budgetHolderId) return toast.error('Please select a Budget Holder')
    if (!financeId) return toast.error('Please select a Finance Officer')

    const steps = [
      { name: 'Requestor', type: 'approval', userId: user.id },
      { name: 'Budget Holder Approval', type: 'approval', userId: budgetHolderId },
      { name: 'Finance Approval', type: 'approval', userId: financeId },
    ]

    mutation.mutate({
      ...form,
      amount: Number(form.amount),
      poId: poId || null,
      steps,
      ccUsers,
    })
  }

  const otherUsers = users.filter(u => u.id !== user?.id && u.id !== budgetHolderId && u.id !== financeId)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <CreditCard size={24} className="text-primary-600" />
          New Payment Requisition
        </h1>
        {poData && (
          <p className="text-sm text-secondary-500 mt-1">
            Linked to: {poData.document_number}{poData.supplier_name ? ` · ${poData.supplier_name}` : ''}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Payee Information */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-secondary-900">Payee Information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Payee / Vendor Name *</label>
              <input className="input" required value={form.payeeName} onChange={e => setField('payeeName', e.target.value)} placeholder="Full name or company name" />
            </div>
            <div>
              <label className="label">Bank Name</label>
              <input className="input" value={form.payeeBank} onChange={e => setField('payeeBank', e.target.value)} placeholder="e.g. Equity Bank" />
            </div>
            <div>
              <label className="label">Account No. / Reference</label>
              <input className="input" value={form.payeeAccount} onChange={e => setField('payeeAccount', e.target.value)} placeholder="Account or M-Pesa number" />
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-secondary-900">Payment Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Currency *</label>
              <select className="input" value={form.currency} onChange={e => setField('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount *</label>
              <input type="number" min="0" step="0.01" className="input" required value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Payment Method *</label>
              <select className="input" value={form.paymentMethod} onChange={e => setField('paymentMethod', e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Budget Line</label>
              <input className="input" value={form.budgetLine} onChange={e => setField('budgetLine', e.target.value)} placeholder="e.g. Admin-2024-Q2" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Purpose of Payment *</label>
              <textarea className="input resize-none" rows={3} required value={form.paymentPurpose} onChange={e => setField('paymentPurpose', e.target.value)} placeholder="Describe what this payment is for…" />
            </div>
          </div>
          {form.amount > 0 && (
            <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-secondary-500">Total amount to be paid</span>
              <span className="text-xl font-bold text-primary-700">
                {form.currency} {Number(form.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Approval Chain — fixed 3-step */}
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-secondary-900">Approval Chain</h2>
            <p className="text-xs text-secondary-500 mt-1">
              Payment requisitions always follow the 3-step authorisation chain: Requestor → Budget Holder → Finance.
            </p>
          </div>

          {/* Step 1: Requestor — read-only */}
          <div className="border border-secondary-200 rounded-lg p-4 bg-secondary-50 opacity-90">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Step 1</span>
                <span className="text-xs bg-secondary-200 text-secondary-700 rounded-full px-2.5 py-0.5 font-medium">Requestor</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-secondary-400">
                <Lock size={10} />
                <span>Auto-assigned</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-bold flex-shrink-0">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-secondary-900">{user?.first_name} {user?.last_name}</p>
                {user?.job_title && <p className="text-xs text-secondary-400">{user.job_title}</p>}
              </div>
              <span className="ml-auto text-xs text-primary-600 font-medium">You</span>
            </div>
          </div>

          {/* Step 2: Budget Holder */}
          <div className="border border-secondary-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Step 2</span>
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-medium">Budget Holder</span>
            </div>
            <div>
              <label className="label text-xs">Select approver *</label>
              <select className="input text-sm" value={budgetHolderId} onChange={e => setBudgetHolderId(e.target.value)}>
                <option value="">Select budget holder…</option>
                {users.filter(u => u.id !== user?.id).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.job_title ? ` — ${u.job_title}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Finance */}
          <div className="border border-secondary-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Step 3</span>
              <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-medium">Finance</span>
            </div>
            <div>
              <label className="label text-xs">Select approver *</label>
              <select className="input text-sm" value={financeId} onChange={e => setFinanceId(e.target.value)}>
                <option value="">Select finance officer…</option>
                {users.filter(u => u.id !== user?.id).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.job_title ? ` — ${u.job_title}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* CC Finance Team */}
          {otherUsers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-secondary-400" />
                <label className="label mb-0 text-sm">CC Finance Team <span className="text-secondary-400 font-normal">(optional)</span></label>
              </div>
              <p className="text-xs text-secondary-400">These users receive email notifications but are not required to approve.</p>
              <div className="border border-secondary-200 rounded-lg divide-y divide-secondary-100 max-h-48 overflow-y-auto">
                {otherUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-secondary-300 text-primary-600 flex-shrink-0"
                      checked={ccUsers.includes(u.id)}
                      onChange={() => toggleCc(u.id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-secondary-900">{u.first_name} {u.last_name}</p>
                      {u.job_title && <p className="text-xs text-secondary-400 truncate">{u.job_title}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Creating…' : 'Create & Save as Draft'}
          </button>
        </div>
      </form>
    </div>
  )
}
