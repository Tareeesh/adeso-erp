import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Bell, ChevronDown, LogOut, User, Settings, Building2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

export default function Header({ onMenuClick }) {
  const { user, companies, activeCompany, logout, switchCompany } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data.count),
    refetchInterval: 30000,
  })

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    enabled: notifOpen,
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-secondary-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-secondary-100 transition-colors">
          <Menu size={20} className="text-secondary-600" />
        </button>
        <h1 className="text-lg font-semibold text-secondary-900">
          {activeCompany?.company_name || 'ERP System'}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Company switcher */}
        {companies.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-secondary-200 hover:bg-secondary-50 text-sm"
            >
              <Building2 size={14} className="text-secondary-500" />
              <span className="text-secondary-700">{activeCompany?.company_name}</span>
              <ChevronDown size={14} className="text-secondary-400" />
            </button>
            {companyMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-secondary-200 rounded-lg shadow-lg z-50">
                {companies.map(c => (
                  <button
                    key={c.company_id}
                    onClick={() => { switchCompany(c.company_id); setCompanyMenuOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary-50 ${c.company_id === activeCompany?.company_id ? 'text-primary-600 font-medium' : 'text-secondary-700'}`}
                  >
                    {c.company_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg hover:bg-secondary-100 transition-colors"
          >
            <Bell size={20} className="text-secondary-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-1 w-80 bg-white border border-secondary-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-secondary-100 font-medium text-sm">Notifications</div>
              {notifications?.length === 0 && <p className="p-4 text-sm text-secondary-500 text-center">No notifications</p>}
              {notifications?.map(n => (
                <div key={n.id} className={`p-3 border-b border-secondary-50 hover:bg-secondary-50 cursor-pointer ${!n.is_read ? 'bg-blue-50' : ''}`}>
                  <p className="text-sm font-medium text-secondary-800">{n.title}</p>
                  <p className="text-xs text-secondary-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-secondary-400 mt-1">{new Date(n.created_at).toLocaleString('en-GB')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary-50 transition-colors"
          >
            <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <span className="text-sm font-medium text-secondary-700">{user?.first_name} {user?.last_name}</span>
            <ChevronDown size={14} className="text-secondary-400" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-secondary-200 rounded-lg shadow-lg z-50">
              <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50" onClick={() => setUserMenuOpen(false)}>
                <User size={14} />Profile
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <LogOut size={14} />Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
