import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Plus, Trash2 } from 'lucide-react'
import ProcurementTierBadge from '../../components/shared/ProcurementTierBadge'

export default function PurchaseEditPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)

  const { data: pr, isLoading } = useQuery({
    queryKey: ['pr-by-document', documentId],
    queryFn: () => api.get(`/operations/purchase/requisitions/by-document/${documentId}`).then(r => r.data),
  })

  useEffect(() => {
    if (!pr) return
    const items = Array.isArray(pr.items) ? pr.items
      : (typeof pr.items === 'string' ? JSON.parse(pr.items) : [{ description: '', quantity: 1, unitPrice: 0, unit: '' }])
    setForm({
      department: pr.department || '',
      projectCode: pr.project_code || '',
      budgetLine: pr.budget_line || '',
      requiredBy: pr.required_by ? pr.required_by.slice(0, 10) : '',
      priority: pr.priority || 'normal',
      justification: pr.justification || '',
      currency: pr.currency || 'KES',
      items: items.length ? items : [{ description: '', quantity: 1, unitPrice: 0, unit: '' }],
    })
  }, [pr])

  const saveMutation = useMutation({
    mutationFn: ({ submitAfterSave }) =>
      api.put(`/operations/purchase/requisitions/${pr.id}`, { ...form, estimatedTotal: total }).then(async () => {
        if (submitAfterSave) await api.post(`/workflows/${documentId}/submit`)
      }),
    onSuccess: (_, { submitAfterSave }) => {
      toast.success(submitAfterSave ? 'Requisition submitted for approval' : 'Draft saved')
      navigate(`/documents/${documentId}`)
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to save'),
  })

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { description: '', quantity: 1, unitPrice: 0, unit: '' }] }))
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, field, val) => setForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }))

  if (isLoading || !form) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  if (pr?.doc_status !== 'draft') return <div className="card p-8 text-center text-secondary-500">Only draft requisitions can be edited.</div>

  const total = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Edit Purchase Requisition</h1>
        <p className="text-sm text-secondary-500 mt-1">This requisition is a draft. Your changes will not be sent for approval until you click Submit.</p>
      </div>

      <div className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-secondary-900">Request Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Department</label><input className="input" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} /></div>
            <div><label className="label">Project Code</label><input className="input" value={form.projectCode} onChange={e => setForm(p => ({ ...p, projectCode: e.target.value }))} /></div>
            <div><label className="label">Budget Line</label><input className="input" value={form.budgetLine} onChange={e => setForm(p => ({ ...p, budgetLine: e.target.value }))} /></div>
            <div><label className="label">Required By</label><input type="date" className="input" value={form.requiredBy} onChange={e => setForm(p => ({ ...p, requiredBy: e.target.value }))} /></div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {['low','normal','high','urgent'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                {['KES','USD','EUR','GBP','UGX','TZS'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Justification *</label><textarea className="input resize-none" rows={3} required value={form.justification} onChange={e => setForm(p => ({ ...p, justification: e.target.value }))} /></div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Items</h2>
            <button type="button" onClick={addItem} className="btn-secondary text-sm flex items-center gap-1"><Plus size={14} />Add Item</button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5"><label className="label text-xs">Description</label><input className="input text-sm" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} required /></div>
                <div className="col-span-2"><label className="label text-xs">Qty</label><input type="number" min="1" className="input text-sm" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></div>
                <div className="col-span-2"><label className="label text-xs">Unit</label><input className="input text-sm" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} placeholder="pcs" /></div>
                <div className="col-span-2"><label className="label text-xs">Unit Price</label><input type="number" min="0" step="0.01" className="input text-sm" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} /></div>
                <div className="col-span-1">{form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}</div>
              </div>
            ))}
          </div>
          <div className="text-right font-semibold text-secondary-900">
            Total: {form.currency} {total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </div>
          {total > 0 && <ProcurementTierBadge amount={total} currency={form.currency} />}
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(`/documents/${documentId}`)} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => saveMutation.mutate({ submitAfterSave: false })} disabled={saveMutation.isPending} className="btn-secondary">
            {saveMutation.isPending ? 'Saving…' : 'Save as Draft'}
          </button>
          <button type="button" onClick={() => saveMutation.mutate({ submitAfterSave: true })} disabled={saveMutation.isPending || !form.justification} className="btn-primary">
            {saveMutation.isPending ? 'Saving…' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  )
}
