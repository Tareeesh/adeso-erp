import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Users, Building2, Settings, Shield } from 'lucide-react'

export default function AdminPage() {
  const { activeCompany } = useAuth()

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: () => api.get('/companies').then(r => r.data) })

  const activeUsers = users.filter(u => u.is_active).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2"><Shield size={24} className="text-primary-600" />Administration</h1>
        <p className="text-secondary-500 text-sm mt-1">{activeCompany?.company_name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { title: 'Total Users', value: users.length, sub: `${activeUsers} active`, icon: Users, color: 'bg-primary-600', link: '/admin/users' },
          { title: 'Companies', value: companies.length, sub: 'registered', icon: Building2, color: 'bg-emerald-600', link: '/admin/companies' },
        ].map(c => (
          <Link key={c.title} to={c.link} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-500">{c.title}</p>
                <p className="text-2xl font-bold text-secondary-900 mt-1">{c.value}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{c.sub}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color}`}>
                <c.icon size={22} className="text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-4 border-b border-secondary-100 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Users size={16} />Recent Users</h2>
            <Link to="/admin/users" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
          </div>
          <div className="divide-y divide-secondary-100">
            {users.slice(0, 5).map(u => (
              <div key={u.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">
                    {u.first_name?.[0]}{u.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary-900">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-secondary-500">{u.role_display || u.role_name || 'Staff'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
            {users.length === 0 && <p className="p-4 text-sm text-secondary-400 text-center">No users yet</p>}
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-secondary-100"><h2 className="font-semibold flex items-center gap-2"><Settings size={16} />Quick Links</h2></div>
          <div className="p-4 space-y-2">
            {[
              { label: 'Manage Users', sub: 'Invite, assign roles, activate/deactivate', link: '/admin/users', icon: Users },
              { label: 'Companies', sub: 'View and manage company settings', link: '/admin/companies', icon: Building2 },
            ].map(item => (
              <Link key={item.link} to={item.link} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center"><item.icon size={16} className="text-primary-600" /></div>
                <div>
                  <p className="text-sm font-medium text-secondary-900">{item.label}</p>
                  <p className="text-xs text-secondary-500">{item.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
