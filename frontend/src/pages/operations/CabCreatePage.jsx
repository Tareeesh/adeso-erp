import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Car } from 'lucide-react'
import ApprovalChainBuilder from '../../components/shared/ApprovalChainBuilder'

export default function CabCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ pickupLocation: '', dropoffLocation: '', pickupDatetime: '', returnDatetime: '', purpose: '', passengers: 1, passengerNames: '', specialRequirements: '' })
  const [steps, setSteps] = useState([{ stepName: 'Line Manager Approval', type: 'internal', userId: '', externalName: '', externalEmail: '' }, { stepName: 'Operations Approval', type: 'internal', userId: '', externalName: '', externalEmail: '' }])

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/operations/cab', data),
    onSuccess: ({ data }) => { toast.success('Cab request created'); navigate(`/documents/${data.document.id}`) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create cab request'),
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
    mutation.mutate({ ...form, passengers: Number(form.passengers), steps: mappedSteps })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
        <Car size={22} className="text-primary-600" /> New Cab Request
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-secondary-900">Journey Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Pickup Location *</label><input className="input" required value={form.pickupLocation} onChange={e => set('pickupLocation', e.target.value)} placeholder="e.g. Office, Nairobi" /></div>
            <div><label className="label">Drop-off Location *</label><input className="input" required value={form.dropoffLocation} onChange={e => set('dropoffLocation', e.target.value)} placeholder="e.g. JKIA Terminal 1" /></div>
            <div><label className="label">Pickup Date & Time *</label><input type="datetime-local" className="input" required value={form.pickupDatetime} onChange={e => set('pickupDatetime', e.target.value)} /></div>
            <div><label className="label">Return Date & Time</label><input type="datetime-local" className="input" value={form.returnDatetime} onChange={e => set('returnDatetime', e.target.value)} /></div>
            <div><label className="label">Passengers *</label><input type="number" min="1" max="20" className="input" required value={form.passengers} onChange={e => set('passengers', e.target.value)} /></div>
          </div>
          <div><label className="label">Purpose *</label><textarea className="input resize-none" rows={2} required value={form.purpose} onChange={e => set('purpose', e.target.value)} /></div>
          <div><label className="label">Passenger Names</label><input className="input" value={form.passengerNames} onChange={e => set('passengerNames', e.target.value)} placeholder="Comma-separated names" /></div>
          <div><label className="label">Special Requirements</label><textarea className="input resize-none" rows={2} value={form.specialRequirements} onChange={e => set('specialRequirements', e.target.value)} /></div>
        </div>

        <ApprovalChainBuilder steps={steps} onChange={setSteps} users={users} />

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">{mutation.isPending ? 'Submitting…' : 'Submit Request'}</button>
        </div>
      </form>
    </div>
  )
}
