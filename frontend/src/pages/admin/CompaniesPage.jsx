import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Building2, Plus, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function CompaniesPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', domain: '', email: '', phone: '', address: '', country: 'Kenya', currency: 'KES' })

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get('/companies').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/companies', data),
    onSuccess: () => { toast.success('Company created'); qc.invalidateQueries(['companies']); setShowCreate(false); setForm({ name: '', domain: '', email: '', phone: '', address: '', country: 'Kenya', currency: 'KES' }) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create company'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <Building2 size={24} className="text-primary-600" /> Companies
        </h1>
        {user?.is_global_admin && (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> New Company
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Create Company</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Company Name *</label><input className="input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">Domain *</label><input className="input" placeholder="adesoafrica.org" value={form.domain} onChange={e => setForm(p => ({ ...p, domain: e.target.value }))} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="md:col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div>
              <label className="label">Country</label>
              <select className="input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}>
                {['Kenya','Uganda','Tanzania','Somalia','Ethiopia','South Sudan','Rwanda'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                {['KES','USD','EUR','UGX','TZS','SOS','ETB'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name || !form.domain} className="btn-primary">
              {createMutation.isPending ? 'Creating…' : 'Create Company'}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {isLoading && <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></div>}
        {!isLoading && companies.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Building2 size={36} className="mx-auto mb-3 text-secondary-200" />
            <p>No companies found.</p>
          </div>
        )}
        {companies.map(c => (
          <div key={c.id} className="flex items-center justify-between p-4 border-b border-secondary-100 last:border-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                {c.logo_url ? <img src={c.logo_url} alt="" className="w-8 h-8 object-contain rounded" /> : <Building2 size={18} className="text-primary-600" />}
              </div>
              <div>
                <p className="font-medium text-secondary-900">{c.name}</p>
                <p className="text-xs text-secondary-500 flex items-center gap-1"><Globe size={11} />{c.domain} · {c.country} · {c.currency}</p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {c.is_active !== false ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
