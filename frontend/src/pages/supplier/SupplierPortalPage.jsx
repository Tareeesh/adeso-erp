import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Building2, Send } from 'lucide-react'

export default function SupplierPortalPage() {
  const { token } = useParams()
  const [form, setForm] = useState({ currency: 'KES', totalAmount: '', deliveryDays: '', validityDays: 30, paymentTerms: '', notes: '', items: [] })

  const { data: portal, isLoading, error } = useQuery({
    queryKey: ['supplier-portal', token],
    queryFn: () => api.get(`/supplier-portal/access/${token}`).then(r => r.data),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (data) => {
      const fd = new FormData()
      Object.entries(data).forEach(([k, v]) => fd.append(k, typeof v === 'object' ? JSON.stringify(v) : v))
      return api.post(`/supplier-portal/submit/${token}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => toast.success('Quote submitted successfully! Thank you.'),
    onError: err => toast.error(err.response?.data?.error || 'Submission failed'),
  })

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>

  if (error) return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <p className="text-red-600 font-semibold">{error.response?.data?.error || 'Invalid or expired link'}</p>
        <p className="text-secondary-500 text-sm mt-2">This quotation link may have already been used or closed.</p>
      </div>
    </div>
  )

  if (mutation.isSuccess) return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Send size={28} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-secondary-900">Quote Submitted!</h2>
        <p className="text-secondary-500 mt-2">Thank you. Your quotation has been received by {portal?.link?.company_name}.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-3">
            <Building2 size={24} className="text-primary-600" />
          </div>
          <h1 className="text-xl font-bold text-white">{portal?.link?.company_name}</h1>
          <p className="text-primary-200 text-sm">Supplier Quotation Portal</p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-6 space-y-5">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-secondary-800">RFQ Reference: <span className="text-primary-600">{portal?.link?.document_number}</span></p>
            <p className="text-sm text-secondary-600 mt-1">Dear {portal?.link?.supplier_name}, please complete your quotation below.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                {['KES','USD','EUR','GBP','UGX','TZS'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Total Amount *</label>
              <input type="number" min="0" step="0.01" className="input" required value={form.totalAmount} onChange={e => setForm(p => ({ ...p, totalAmount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Delivery Days</label>
              <input type="number" min="1" className="input" value={form.deliveryDays} onChange={e => setForm(p => ({ ...p, deliveryDays: e.target.value }))} />
            </div>
            <div>
              <label className="label">Validity (days)</label>
              <input type="number" min="1" className="input" value={form.validityDays} onChange={e => setForm(p => ({ ...p, validityDays: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Payment Terms</label>
            <input className="input" value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} placeholder="e.g. 30 days net, 50% upfront" />
          </div>

          <div>
            <label className="label">Additional Notes</label>
            <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <button
            onClick={() => mutation.mutate(form)}
            disabled={!form.totalAmount || mutation.isPending}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {mutation.isPending ? 'Submitting...' : 'Submit Quotation'}
          </button>
          <p className="text-xs text-secondary-400 text-center">This link is unique to you and will expire after submission.</p>
        </div>
      </div>
    </div>
  )
}
