import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Plus, Trash2, FileSearch } from 'lucide-react'
import ApprovalChainBuilder from '../../components/shared/ApprovalChainBuilder'

export default function RFQCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prId = searchParams.get('prId')

  const [form, setForm] = useState({ title: '', deadline: '', instructions: '', items: [{ description: '', quantity: 1, unit: '', specifications: '' }] })
  const [supplierEmails, setSupplierEmails] = useState([''])
  const [steps, setSteps] = useState([{ stepName: 'Operations Review', type: 'internal', userId: '', externalName: '', externalEmail: '' }])

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/operations/purchase/suppliers').then(r => r.data) })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/operations/purchase/rfq', data),
    onSuccess: ({ data }) => { toast.success('RFQ created — suppliers will be notified'); navigate(`/documents/${data.document.id}`) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create RFQ'),
  })

  const updateItem = (i, field, val) => setForm(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }))
  const set = (field, val) => setForm(p => ({ ...p, [field]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const mappedSteps = steps
      .filter(s => (s.type === 'internal' && s.userId) || (s.type === 'external' && s.externalEmail))
      .map(s => ({
        name: s.stepName || 'Review',
        type: 'approval',
        ...(s.type === 'internal' ? { userId: s.userId } : { externalName: s.externalName, externalEmail: s.externalEmail }),
      }))
    const invitedSuppliers = supplierEmails.filter(e => e.trim())
    mutation.mutate({ prId: prId || undefined, ...form, steps: mappedSteps, invitedSuppliers })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
        <FileSearch size={22} className="text-primary-600" /> New Request for Quotation
      </h1>
      {prId && <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-700">Linked to PR: {prId.slice(0, 8)}…</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">RFQ Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Title *</label><input className="input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Office Furniture Supply" /></div>
            <div><label className="label">Submission Deadline *</label><input type="date" className="input" required value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
          </div>
          <div><label className="label">Instructions to Suppliers</label><textarea className="input resize-none" rows={3} value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Include bid submission requirements, evaluation criteria, etc." /></div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Items Required</h2>
            <button type="button" onClick={() => setForm(p => ({ ...p, items: [...p.items, { description: '', quantity: 1, unit: '', specifications: '' }] }))} className="btn-secondary text-sm flex items-center gap-1"><Plus size={14} />Add Item</button>
          </div>
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5"><label className="label text-xs">Description</label><input className="input text-sm" required value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} /></div>
              <div className="col-span-2"><label className="label text-xs">Qty</label><input type="number" min="1" className="input text-sm" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></div>
              <div className="col-span-2"><label className="label text-xs">Unit</label><input className="input text-sm" placeholder="pcs" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} /></div>
              <div className="col-span-2"><label className="label text-xs">Specifications</label><input className="input text-sm" value={item.specifications} onChange={e => updateItem(i, 'specifications', e.target.value)} /></div>
              <div className="col-span-1">{form.items.length > 1 && <button type="button" onClick={() => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}</div>
            </div>
          ))}
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Invite Suppliers</h2>
          <p className="text-xs text-secondary-500">Enter supplier email addresses. Each will receive a unique secure link to submit their quote.</p>
          {supplierEmails.map((email, i) => (
            <div key={i} className="flex gap-2">
              <input type="email" className="input flex-1" placeholder="supplier@company.com" value={email} onChange={e => setSupplierEmails(p => p.map((v, idx) => idx === i ? e.target.value : v))} />
              {supplierEmails.length > 1 && <button type="button" onClick={() => setSupplierEmails(p => p.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
            </div>
          ))}
          <button type="button" onClick={() => setSupplierEmails(p => [...p, ''])} className="btn-secondary text-sm flex items-center gap-1"><Plus size={14} />Add Supplier</button>
        </div>

        <ApprovalChainBuilder steps={steps} onChange={setSteps} users={users} />

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">{mutation.isPending ? 'Creating…' : 'Create RFQ'}</button>
        </div>
      </form>
    </div>
  )
}
