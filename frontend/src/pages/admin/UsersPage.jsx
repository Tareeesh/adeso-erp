import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Users, Plus, UserCheck, UserX, Pencil, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function UsersPage() {
  const qc = useQueryClient()
  const { hasRole } = useAuth()
  const canManage = hasRole('company_admin', 'global_admin')

  const [showInvite, setShowInvite] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', jobTitle: '', roleId: '' })
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', jobTitle: '', roleId: '' })

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/users/roles').then(r => r.data),
  })

  const inviteMutation = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => { toast.success('User invited — they will receive an email with credentials'); qc.invalidateQueries(['users']); setShowInvite(false); setForm({ email: '', firstName: '', lastName: '', jobTitle: '', roleId: '' }) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to invite user'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/users/${id}`, data),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries(['users']); setEditUser(null) },
    onError: err => toast.error(err.response?.data?.error || 'Failed to update user'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/users/${id}/status`, { isActive }),
    onSuccess: () => { toast.success('User status updated'); qc.invalidateQueries(['users']) },
    onError: () => toast.error('Failed to update status'),
  })

  const openEdit = (u) => {
    setEditUser(u)
    setEditForm({ firstName: u.first_name || '', lastName: u.last_name || '', jobTitle: u.job_title || '', roleId: u.role_id || '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <Users size={24} className="text-primary-600" /> Users & Roles
        </h1>
        {canManage && (
          <button onClick={() => setShowInvite(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Invite User
          </button>
        )}
      </div>

      {!canManage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          You have read-only access to the user list. Contact a Company Admin to manage users.
        </div>
      )}

      {showInvite && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-secondary-900">Invite New User</h2>
            <button onClick={() => setShowInvite(false)} className="p-1 text-secondary-400 hover:text-secondary-700"><X size={16} /></button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">First Name *</label><input className="input" required value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} /></div>
            <div><label className="label">Last Name *</label><input className="input" required value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} /></div>
            <div><label className="label">Email *</label><input type="email" className="input" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label className="label">Job Title</label><input className="input" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} /></div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}>
                <option value="">Select role…</option>
                {roles.filter(r => r.name !== 'global_admin').map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => inviteMutation.mutate(form)} disabled={inviteMutation.isPending || !form.email || !form.firstName || !form.roleId} className="btn-primary">
              {inviteMutation.isPending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-secondary-900">Edit User</h2>
              <button onClick={() => setEditUser(null)} className="p-1 text-secondary-400 hover:text-secondary-700"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">First Name</label><input className="input" value={editForm.firstName} onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))} /></div>
              <div><label className="label">Last Name</label><input className="input" value={editForm.lastName} onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))} /></div>
              <div className="col-span-2"><label className="label">Job Title</label><input className="input" value={editForm.jobTitle} onChange={e => setEditForm(p => ({ ...p, jobTitle: e.target.value }))} /></div>
              <div className="col-span-2">
                <label className="label">Role</label>
                <select className="input" value={editForm.roleId} onChange={e => setEditForm(p => ({ ...p, roleId: e.target.value }))}>
                  <option value="">Keep current role</option>
                  {roles.filter(r => r.name !== 'global_admin').map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditUser(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => editMutation.mutate({ id: editUser.id, ...editForm })} disabled={editMutation.isPending} className="btn-primary">
                {editMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {isLoading && <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></div>}
        {!isLoading && users.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Users size={36} className="mx-auto mb-3 text-secondary-200" />
            <p>No users yet. Invite someone to get started.</p>
          </div>
        )}
        {users.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                    {u.first_name?.[0]}{u.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-secondary-500">{u.email} · {u.job_title || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary-500 hidden md:block">{u.role_display || u.role_name || '—'}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {canManage && (
                    <>
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded hover:bg-secondary-100 text-secondary-400 hover:text-primary-600"
                        title="Edit user"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => statusMutation.mutate({ id: u.id, isActive: !u.is_active })}
                        className="p-1.5 rounded hover:bg-secondary-100 text-secondary-400 hover:text-secondary-700"
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
