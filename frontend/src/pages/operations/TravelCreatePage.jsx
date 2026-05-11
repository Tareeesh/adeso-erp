import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import ApprovalChainBuilder from '../../components/shared/ApprovalChainBuilder'

export default function TravelCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ travelerName: '', destination: '', departureDate: '', returnDate: '', purpose: '', transportationMode: 'road', accommodation: '', estimatedCost: '', currency: 'KES', perDiem: '', advanceRequested: '', budgetLine: '', additionalNotes: '' })
  const [steps, setSteps] = useState([{ stepName: 'Line Manager Approval', type: 'internal', userId: '', externalName: '', externalEmail: '' }, { stepName: 'Finance Approval', type: 'internal', userId: '', externalName: '', externalEmail: '' }])

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/operations/travel', data),
    onSuccess: ({ data }) => { toast.success('Travel authorization created'); navigate(`/documents/${data.document.id}`) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create request'),
  })

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const mappedSteps = steps
      .filter(s => (s.type === 'internal' && s.userId) || (s.type === 'external' && s.externalEmail))
      .map(s => ({
        name: s.stepName || 'Approval',
        type: 'approval',
        ...(s.type === 'internal' ? { userId: s.userId } : { externalName: s.externalName, externalEmail: s.externalEmail }),
      }))
    mutation.mutate({ ...form, steps: mappedSteps })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900">New Travel Authorization</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Travel Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Traveler Name *</label><input className="input" required value={form.travelerName} onChange={e => set('travelerName', e.target.value)} /></div>
            <div><label className="label">Destination *</label><input className="input" required value={form.destination} onChange={e => set('destination', e.target.value)} /></div>
            <div><label className="label">Departure Date *</label><input type="date" className="input" required value={form.departureDate} onChange={e => set('departureDate', e.target.value)} /></div>
            <div><label className="label">Return Date</label><input type="date" className="input" value={form.returnDate} onChange={e => set('returnDate', e.target.value)} /></div>
            <div>
              <label className="label">Transportation Mode</label>
              <select className="input" value={form.transportationMode} onChange={e => set('transportationMode', e.target.value)}>
                {['road','air','rail','sea'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="label">Accommodation</label><input className="input" placeholder="Hotel name or arrangement" value={form.accommodation} onChange={e => set('accommodation', e.target.value)} /></div>
            <div><label className="label">Budget Line</label><input className="input" value={form.budgetLine} onChange={e => set('budgetLine', e.target.value)} /></div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['KES','USD','EUR','GBP','UGX','TZS'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Estimated Cost</label><input type="number" min="0" step="0.01" className="input" value={form.estimatedCost} onChange={e => set('estimatedCost', e.target.value)} /></div>
            <div><label className="label">Per Diem</label><input type="number" min="0" step="0.01" className="input" value={form.perDiem} onChange={e => set('perDiem', e.target.value)} /></div>
            <div><label className="label">Cash Advance Requested</label><input type="number" min="0" step="0.01" className="input" value={form.advanceRequested} onChange={e => set('advanceRequested', e.target.value)} /></div>
          </div>
          <div><label className="label">Purpose *</label><textarea className="input resize-none" rows={3} required value={form.purpose} onChange={e => set('purpose', e.target.value)} /></div>
          <div><label className="label">Additional Notes</label><textarea className="input resize-none" rows={2} value={form.additionalNotes} onChange={e => set('additionalNotes', e.target.value)} /></div>
        </div>

        <ApprovalChainBuilder steps={steps} onChange={setSteps} users={users} />

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">{mutation.isPending ? 'Creating…' : 'Submit Request'}</button>
        </div>
      </form>
    </div>
  )
}
