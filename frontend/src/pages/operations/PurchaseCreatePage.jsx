import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Plus, Trash2 } from 'lucide-react'

export default function PurchaseCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ department: '', projectCode: '', budgetLine: '', requiredBy: '', priority: 'normal', justification: '', currency: 'KES', items: [{ description: '', quantity: 1, unitPrice: 0, unit: '' }] })
  const [signatories, setSignatories] = useState([{ name: '', userId: '', stepName: '' }])

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/operations/purchase/requisitions', data),
    onSuccess: ({ data }) => { toast.success('Purchase requisition created'); navigate(`/documents/${data.document.id}`) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create'),
  })

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { description: '', quantity: 1, unitPrice: 0, unit: '' }] }))
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, field, val) => setForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }))

  const total = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    const steps = signatories.filter(s => s.userId).map(s => ({ name: s.stepName || 'Approval', type: 'approval', userId: s.userId }))
    mutation.mutate({ ...form, estimatedTotal: total, steps })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900">New Purchase Requisition</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
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
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Approval Chain</h2>
          {signatories.map((sig, i) => (
            <div key={i} className="grid md:grid-cols-3 gap-3 items-end">
              <div><label className="label text-xs">Step {i + 1} Name</label><input className="input text-sm" value={sig.stepName} onChange={e => setSignatories(p => p.map((s, idx) => idx === i ? { ...s, stepName: e.target.value } : s))} placeholder="e.g. Line Manager Approval" /></div>
              <div>
                <label className="label text-xs">Assigned To</label>
                <select className="input text-sm" value={sig.userId} onChange={e => setSignatories(p => p.map((s, idx) => idx === i ? { ...s, userId: e.target.value } : s))}>
                  <option value="">Select approver...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
              <div>{signatories.length > 1 && <button type="button" onClick={() => setSignatories(p => p.filter((_, idx) => idx !== i))} className="btn-secondary text-sm">Remove</button>}</div>
            </div>
          ))}
          <button type="button" onClick={() => setSignatories(p => [...p, { name: '', userId: '', stepName: '' }])} className="btn-secondary text-sm flex items-center gap-1"><Plus size={14} />Add Approver</button>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">{mutation.isPending ? 'Creating...' : 'Create & Save Draft'}</button>
        </div>
      </form>
    </div>
  )
}
