import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { CreditCard, Users } from 'lucide-react'

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cash', label: 'Cash' },
  { value: 'petty_cash', label: 'Petty Cash' },
]

const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'ETB', 'SOS']

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function numWords(n) {
  if (n === 0) return 'Zero'
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numWords(n % 100) : '')
  if (n < 1000000) return numWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numWords(n % 1000) : '')
  if (n < 1000000000) return numWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + numWords(n % 1000000) : '')
  return numWords(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 ? ' ' + numWords(n % 1000000000) : '')
}

function toAmountInWords(amount, currency) {
  if (!amount || isNaN(Number(amount))) return ''
  const [intPart, decPart] = Number(amount).toFixed(2).split('.')
  const cents = parseInt(decPart)
  const words = numWords(parseInt(intPart))
  return `${currency} ${words}${cents > 0 ? ` and ${numWords(cents)}/100` : ' Only'}`
}

export default function PaymentCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const poId = searchParams.get('poId')

  const [form, setForm] = useState({
    payeeName: '',
    payingOffice: '',
    payeeAccount: '',
    payeeBank: '',
    currency: 'KES',
    amount: '',
    paymentMethod: 'bank_transfer',
    paymentPurpose: '',
    budgetLine: '',
    budgetCode: '',
    projectCode: '',
  })
  const [amountInWords, setAmountInWords] = useState('')
  const [procurementOfficerId, setProcurementOfficerId] = useState('')
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
        payeeName: p.payeeName || poData.supplier_name || '',
        currency: p.currency || poData.currency || 'KES',
        amount: p.amount || poData.total_amount || '',
      }))
    }
  }, [poData])

  useEffect(() => {
    setAmountInWords(toAmountInWords(form.amount, form.currency))
  }, [form.amount, form.currency])

  const mutation = useMutation({
    mutationFn: (data) => api.post('/operations/purchase/payments', data),
    onSuccess: ({ data }) => {
      toast.success('Payment requisition created')
      navigate(`/documents/${data.document.id}`)
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create'),
  })

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }))
  const toggleCc = (id) => setCcUsers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.payeeName.trim()) return toast.error('Payee name is required')
    if (!form.amount || isNaN(Number(form.amount))) return toast.error('Enter a valid amount')
    if (!procurementOfficerId) return toast.error('Select a Procurement Officer')
    if (!budgetHolderId) return toast.error('Select a Budget Holder')
    if (!financeId) return toast.error('Select a Finance Officer')

    const steps = [
      { name: 'Procurement Officer', type: 'approval', userId: procurementOfficerId },
      { name: 'Budget Holder Approval', type: 'approval', userId: budgetHolderId },
      { name: 'Finance Approval', type: 'approval', userId: financeId },
    ]

    mutation.mutate({
      ...form,
      amount: Number(form.amount),
      amountInWords,
      poId: poId || null,
      steps,
      ccUsers,
    })
  }

  const selectedApprovers = [procurementOfficerId, budgetHolderId, financeId].filter(Boolean)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <CreditCard size={22} className="text-primary-600" />
          New Payment Requisition
        </h1>
        <p className="text-sm text-secondary-500 mt-1">Complete all sections before submitting for approval</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Payment Details */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-secondary-800 text-sm uppercase tracking-wide">Payment Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Payee Name *</label>
              <input className="input" placeholder="Full name of person or organisation to be paid" value={form.payeeName} onChange={e => set('payeeName', e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className="label">Paying Office *</label>
              <input className="input" placeholder="e.g. ADESO Mogadishu Office, ADESO Nairobi HQ" value={form.payingOffice} onChange={e => set('payingOffice', e.target.value)} />
            </div>

            <div>
              <label className="label">Bank Name</label>
              <input className="input" placeholder="e.g. Equity Bank Kenya" value={form.payeeBank} onChange={e => set('payeeBank', e.target.value)} />
            </div>

            <div>
              <label className="label">Account Number</label>
              <input className="input" placeholder="Bank account or M-Pesa number" value={form.payeeAccount} onChange={e => set('payeeAccount', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-secondary-800 text-sm uppercase tracking-wide">Amount & Payment Mode</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Currency *</label>
              <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="label">Amount *</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
          </div>

          {amountInWords && (
            <div className="bg-secondary-50 rounded-lg px-4 py-3">
              <p className="text-xs text-secondary-400 uppercase tracking-wide font-medium mb-0.5">Amount in Words</p>
              <p className="text-sm text-secondary-800 font-medium">{amountInWords}</p>
            </div>
          )}

          <div>
            <label className="label">Mode of Payment *</label>
            <select className="input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Reason for Payment *</label>
            <textarea className="input" rows={3} placeholder="Describe what this payment is for in detail…" value={form.paymentPurpose} onChange={e => set('paymentPurpose', e.target.value)} />
          </div>
        </div>

        {/* Budget & Project Coding */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-secondary-800 text-sm uppercase tracking-wide">Budget & Project Coding</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Budget Line</label>
              <input className="input" placeholder="e.g. Programme Supplies" value={form.budgetLine} onChange={e => set('budgetLine', e.target.value)} />
            </div>
            <div>
              <label className="label">Budget Code</label>
              <input className="input" placeholder="e.g. ADM-2024-001" value={form.budgetCode} onChange={e => set('budgetCode', e.target.value)} />
            </div>
            <div>
              <label className="label">Project Code</label>
              <input className="input" placeholder="e.g. PROJ-KE-001" value={form.projectCode} onChange={e => set('projectCode', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Approval Chain */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-secondary-800 text-sm uppercase tracking-wide">Approval Chain</h2>
          <p className="text-xs text-secondary-400">Select the approvers for this payment requisition. Approvals will proceed in order.</p>

          {/* Step 1 */}
          <div className="border border-secondary-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Step 1</span>
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 font-medium">Procurement Officer</span>
            </div>
            <div>
              <label className="label text-xs">Select Procurement Officer *</label>
              <select className="input text-sm" value={procurementOfficerId} onChange={e => setProcurementOfficerId(e.target.value)}>
                <option value="">Select procurement officer…</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.job_title ? ` — ${u.job_title}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border border-secondary-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Step 2</span>
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-medium">Budget Holder</span>
            </div>
            <div>
              <label className="label text-xs">Select Budget Holder *</label>
              <select className="input text-sm" value={budgetHolderId} onChange={e => setBudgetHolderId(e.target.value)}>
                <option value="">Select budget holder…</option>
                {users.filter(u => u.id !== procurementOfficerId).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.job_title ? ` — ${u.job_title}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3 */}
          <div className="border border-secondary-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Step 3</span>
              <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-medium">Finance — Final Signature</span>
            </div>
            <div>
              <label className="label text-xs">Select Finance Officer *</label>
              <select className="input text-sm" value={financeId} onChange={e => setFinanceId(e.target.value)}>
                <option value="">Select finance officer…</option>
                {users.filter(u => u.id !== procurementOfficerId && u.id !== budgetHolderId).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.job_title ? ` — ${u.job_title}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CC */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-secondary-400" />
            <h2 className="font-semibold text-secondary-800 text-sm uppercase tracking-wide">CC — For Information Only</h2>
          </div>
          <p className="text-xs text-secondary-400">These people receive email notifications but are not required to approve.</p>

          <div className="border border-secondary-200 rounded-lg divide-y divide-secondary-100 max-h-52 overflow-y-auto">
            {users.filter(u => !selectedApprovers.includes(u.id)).map(u => (
              <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary-50 cursor-pointer">
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
