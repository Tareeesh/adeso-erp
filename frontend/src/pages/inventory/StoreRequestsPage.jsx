import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { ShoppingCart, Plus, Trash2, X } from 'lucide-react'

const EMPTY_ITEM = { itemId: '', quantityRequested: 1, notes: '' }

export default function StoreRequestsPage() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    warehouseId: '',
    departmentId: '',
    requiredBy: '',
    purpose: '',
    lineManagerId: '',
    inventoryOfficerId: '',
  })
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['store-requests'],
    queryFn: () => api.get('/inventory/store-requests').then(r => r.data),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/inventory/warehouses').then(r => r.data),
  })

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: () => api.get('/inventory/items').then(r => r.data),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/inventory/store-requests', data),
    onSuccess: ({ data }) => {
      toast.success('Store request created')
      navigate(`/documents/${data.document.id}`)
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create store request'),
  })

  const setField = (field, val) => setForm(p => ({ ...p, [field]: val }))

  const addItem = () => setItems(p => [...p, { ...EMPTY_ITEM }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) =>
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  const handleSubmit = (e) => {
    e.preventDefault()
    const validItems = items.filter(it => it.itemId)
    if (!validItems.length) {
      toast.error('Add at least one item')
      return
    }
    mutation.mutate({
      ...form,
      items: validItems.map(it => ({
        itemId: it.itemId,
        quantityRequested: Number(it.quantityRequested),
        notes: it.notes,
      })),
    })
  }

  const resetForm = () => {
    setForm({ warehouseId: '', departmentId: '', requiredBy: '', purpose: '', lineManagerId: '', inventoryOfficerId: '' })
    setItems([{ ...EMPTY_ITEM }])
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <ShoppingCart size={24} className="text-primary-600" />
          Store Requests
        </h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />New Request
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-secondary-900">New Store Request</h2>
            <button onClick={resetForm} className="text-secondary-400 hover:text-secondary-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Warehouse *</label>
                <select className="input" required value={form.warehouseId} onChange={e => setField('warehouseId', e.target.value)}>
                  <option value="">Select warehouse…</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Required By</label>
                <input type="date" className="input" value={form.requiredBy} onChange={e => setField('requiredBy', e.target.value)} />
              </div>
              <div>
                <label className="label">Department</label>
                <input className="input" value={form.departmentId} onChange={e => setField('departmentId', e.target.value)} placeholder="Department or cost centre" />
              </div>
            </div>
            <div>
              <label className="label">Purpose *</label>
              <textarea className="input resize-none" rows={2} required value={form.purpose} onChange={e => setField('purpose', e.target.value)} placeholder="Reason for this request" />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-secondary-900">Items</h3>
                <button type="button" onClick={addItem} className="btn-secondary text-sm flex items-center gap-1">
                  <Plus size={14} />Add Item
                </button>
              </div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <label className="label text-xs">Item *</label>
                      <select
                        className="input text-sm"
                        value={item.itemId}
                        onChange={e => updateItem(i, 'itemId', e.target.value)}
                        required
                      >
                        <option value="">Select item…</option>
                        {inventoryItems.map(it => (
                          <option key={it.id} value={it.id}>{it.name} {it.sku ? `(${it.sku})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="label text-xs">Qty</label>
                      <input
                        type="number"
                        min="1"
                        className="input text-sm"
                        value={item.quantityRequested}
                        onChange={e => updateItem(i, 'quantityRequested', e.target.value)}
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="label text-xs">Notes</label>
                      <input
                        className="input text-sm"
                        value={item.notes}
                        onChange={e => updateItem(i, 'notes', e.target.value)}
                        placeholder="Optional note"
                      />
                    </div>
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="p-2 text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approvers */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Line Manager</label>
                <select className="input" value={form.lineManagerId} onChange={e => setField('lineManagerId', e.target.value)}>
                  <option value="">Select line manager…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Inventory Officer</label>
                <select className="input" value={form.inventoryOfficerId} onChange={e => setField('inventoryOfficerId', e.target.value)}>
                  <option value="">Select inventory officer…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary">
                {mutation.isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}
        {!isLoading && requests.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <ShoppingCart size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No store requests yet</p>
            <p className="text-sm mt-1">Click "New Request" to create one</p>
          </div>
        )}
        {requests.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {requests.map(r => (
              <Link
                key={r.id}
                to={`/documents/${r.document_id}`}
                className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                    <ShoppingCart size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">
                      {r.document_number || `Request #${r.id}`}
                    </p>
                    <p className="text-xs text-secondary-500 mt-0.5">
                      {r.purpose}
                      {r.warehouse_name ? ` · ${r.warehouse_name}` : ''}
                      {r.requestor_name ? ` · ${r.requestor_name}` : ''}
                    </p>
                    {r.required_by && (
                      <p className="text-xs text-secondary-400 mt-0.5">
                        Required by {new Date(r.required_by).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`badge-${r.status}`}>{r.status}</span>
                  {r.items?.length > 0 && (
                    <p className="text-xs text-secondary-400 mt-1">
                      {r.items.length} item{r.items.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
