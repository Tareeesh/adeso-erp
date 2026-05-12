import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'
import { User, Lock, PenTool } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { useRef } from 'react'

export default function ProfilePage() {
  const { user, loadProfile } = useAuth()
  const [form, setForm] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    phone: user?.phone || '',
    jobTitle: user?.job_title || '',
    timezone: user?.timezone || 'Africa/Nairobi',
  })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [sigMode, setSigMode] = useState('typed')
  const [typedName, setTypedName] = useState(`${user?.first_name || ''} ${user?.last_name || ''}`.trim())
  const sigCanvas = useRef(null)

  const profileMutation = useMutation({
    mutationFn: (data) => api.put('/auth/me', data).then(r => r.data),
    onSuccess: () => {
      toast.success('Profile updated')
      loadProfile()
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const pwMutation = useMutation({
    mutationFn: (data) => api.put('/auth/me/password', data),
    onSuccess: () => {
      toast.success('Password changed')
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to change password'),
  })

  const sigMutation = useMutation({
    mutationFn: (data) => api.put('/auth/me/signature', data).then(r => r.data),
    onSuccess: () => {
      toast.success('Signature saved')
      loadProfile()
    },
    onError: () => toast.error('Failed to save signature'),
  })

  const handleSaveSig = () => {
    if (sigMode === 'typed') {
      if (!typedName.trim()) return toast.error('Please enter your name')
      sigMutation.mutate({ signatureData: typedName.trim(), signatureType: 'typed', typedName: typedName.trim() })
    } else if (sigMode === 'drawn') {
      if (!sigCanvas.current || sigCanvas.current.isEmpty()) return toast.error('Please draw your signature')
      const data = sigCanvas.current.toDataURL('image/png')
      sigMutation.mutate({ signatureData: data, signatureType: 'drawn' })
    }
  }

  const handlePwSubmit = (e) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirm) return toast.error('Passwords do not match')
    if (pwForm.newPassword.length < 8) return toast.error('Password must be at least 8 characters')
    pwMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
        <User size={22} className="text-primary-600" /> My Profile
      </h1>

      {/* Profile Info */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-secondary-900">Personal Information</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">First Name</label>
            <input className="input" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Job Title</label>
            <input className="input" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Timezone</label>
            <select className="input" value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
              {['Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'UTC', 'Europe/London', 'America/New_York'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => profileMutation.mutate(form)}
            disabled={profileMutation.isPending}
            className="btn-primary"
          >
            {profileMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Signature */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
          <PenTool size={16} /> My Signature
        </h2>
        {user?.signature_url && (
          <div className="p-3 bg-secondary-50 rounded-lg border border-secondary-200">
            <p className="text-xs text-secondary-400 mb-2">Current signature:</p>
            {user.signature_type === 'typed'
              ? <p className="font-signature text-2xl text-secondary-800">{user.signature_url}</p>
              : <img src={user.signature_url} alt="signature" className="max-h-16 object-contain" />}
          </div>
        )}
        <div className="flex gap-2">
          {['typed', 'drawn'].map(m => (
            <button key={m} onClick={() => setSigMode(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${sigMode === m ? 'bg-primary-600 text-white border-primary-600' : 'border-secondary-200 text-secondary-600 hover:border-secondary-300'}`}>
              {m === 'typed' ? 'Type' : 'Draw'}
            </button>
          ))}
        </div>
        {sigMode === 'typed' && (
          <input className="input text-lg font-signature" placeholder="Type your full name" value={typedName} onChange={e => setTypedName(e.target.value)} />
        )}
        {sigMode === 'drawn' && (
          <div className="border border-secondary-200 rounded-lg overflow-hidden bg-white">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{ width: 500, height: 150, className: 'w-full' }}
              backgroundColor="white"
            />
            <div className="border-t border-secondary-100 p-2 flex justify-end">
              <button onClick={() => sigCanvas.current?.clear()} className="text-xs text-secondary-400 hover:text-secondary-600">Clear</button>
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <button onClick={handleSaveSig} disabled={sigMutation.isPending} className="btn-primary">
            {sigMutation.isPending ? 'Saving…' : 'Save Signature'}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-secondary-900 flex items-center gap-2">
          <Lock size={16} /> Change Password
        </h2>
        <form onSubmit={handlePwSubmit} className="space-y-3">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} required minLength={8} />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={pwMutation.isPending} className="btn-primary">
              {pwMutation.isPending ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
