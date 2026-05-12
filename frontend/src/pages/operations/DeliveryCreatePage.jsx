import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Truck, Plus, Trash2, Upload, Paperclip } from 'lucide-react'

export default function DeliveryCreatePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [sp] = useSearchParams()
  const preselectedPoId = sp.get('poId') || ''

  const [poId, setPoId] = useState(preselectedPoId)
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [inspectionStatus, setInspectionStatus] = useState('passed')
  const [inspectionNotes, setInspectionNotes] = useState('')
  const [items, setItems] = useState([{ description: '', quantityOrdered: '', quantityReceived: '', condition: 'good', remarks: '' }])
  const [uploading, setUploading] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [attachments, setAttachments] = useState([])

  const { data: orders = [] } = useQuery({
    queryKey: ['po-list-for-delivery'],
    queryFn: () => api.get('/operations/orders').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/operations/delivery', payload),
    onSuccess: async (res) => {
      toast.success('Delivery recorded')
      setSavedId(res.data.id)
      qc.invalidateQueries(['deliveries'])
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to record delivery'),
  })

  const addItem = () => setItems(p => [...p, { description: '', quantityOrdered: '', quantityReceived: '', condition: 'good', remarks: '' }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!poId) return toast.error('Select a Purchase Order')
    const validItems = items.filter(it => it.description.trim())
    if (!validItems.length) return toast.error('Add at least one item')
    mutation.mutate({ poId, receivedDate, inspectionStatus, inspectionNotes, itemsReceived: validItems })
  }

  const handleUpload = async (file) => {
    if (!savedId) return toast.error('Save the delivery record first')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post(`/attachments/delivery_inspection/${savedId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAttachments(p => [...p, data])
      toast.success('File uploaded')
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-secondary-900">Record Delivery / GRN</h1>
        <p className="text-sm text-secondary-500 mt-0.5">Record goods received against a Purchase Order</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-4 space-y-4">
          <h2 className="font-semibold text-secondary-800">Delivery Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Purchase Order *</label>
              <select className="input text-sm" value={poId} onChange={e => setPoId(e.target.value)} disabled={!!preselectedPoId}>
                <option value="">Select PO…</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>{o.document_number} — {o.supplier_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date Received *</label>
              <input type="date" className="input text-sm" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Inspection Outcome *</label>
              <select className="input text-sm" value={inspectionStatus} onChange={e => setInspectionStatus(e.target.value)}>
                <option value="passed">Passed — All items received in good condition</option>
                <option value="partial">Partial — Some items missing or damaged</option>
                <option value="failed">Failed — Goods rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Inspection Notes</label>
            <textarea className="input text-sm" rows={2} placeholder="Any observations, discrepancies or comments…" value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)} />
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-secondary-800">Items Received</h2>
            <button type="button" onClick={addItem} className="btn-secondary text-xs flex items-center gap-1.5">
              <Plus size={13} /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-secondary-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-secondary-400 uppercase">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-secondary-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <input className="input text-sm" placeholder="Item description *" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                  </div>
                  <input className="input text-sm" placeholder="Qty ordered" type="number" value={item.quantityOrdered} onChange={e => updateItem(i, 'quantityOrdered', e.target.value)} />
                  <input className="input text-sm" placeholder="Qty received *" type="number" value={item.quantityReceived} onChange={e => updateItem(i, 'quantityReceived', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select className="input text-sm" value={item.condition} onChange={e => updateItem(i, 'condition', e.target.value)}>
                    <option value="good">Good condition</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing</option>
                  </select>
                  <input className="input text-sm" placeholder="Remarks (optional)" value={item.remarks} onChange={e => updateItem(i, 'remarks', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
            <Truck size={15} /> {mutation.isPending ? 'Saving…' : 'Record Delivery'}
          </button>
        </div>
      </form>

      {savedId && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-secondary-800">Supporting Documents</h2>
          <p className="text-xs text-secondary-400">Upload delivery note, packing list, certificate of completion, photos, etc.</p>
          <label className="flex items-center gap-2 btn-secondary text-sm cursor-pointer w-fit">
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Document'}
            <input type="file" className="hidden" onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} disabled={uploading} />
          </label>
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 text-sm text-secondary-700 bg-secondary-50 rounded px-3 py-2">
              <Paperclip size={13} className="text-secondary-400" />
              <a href={att.download_url} target="_blank" rel="noreferrer" className="hover:text-primary-600">{att.file_name}</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
