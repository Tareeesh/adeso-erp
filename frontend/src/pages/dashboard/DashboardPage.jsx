import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { CheckSquare, Clock, AlertTriangle, TrendingUp, Package, Archive, Users, Briefcase } from 'lucide-react'

const StatCard = ({ icon: Icon, label, value, color, link }) => (
  <Link to={link || '#'} className="card p-5 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-secondary-500">{label}</p>
        <p className="text-2xl font-bold text-secondary-900 mt-1">{value ?? '—'}</p>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
    </div>
  </Link>
)

export default function DashboardPage() {
  const { user, activeCompany, hasModule } = useAuth()

  const { data: tasks = [] } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/workflows/my-tasks').then(r => r.data),
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
  })

  const { data: lowStockAlerts = [] } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: () => api.get('/inventory/alerts').then(r => r.data),
    enabled: hasModule('inventory'),
  })

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">
          Good morning, {user?.first_name} 👋
        </h1>
        <p className="text-secondary-500 text-sm mt-1">{activeCompany?.company_name} — {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} label="Pending My Action" value={tasks.length} color="bg-primary-600" link="/my-tasks" />
        <StatCard icon={Clock} label="Unread Notifications" value={unread} color="bg-yellow-500" />
        {hasModule('inventory') && <StatCard icon={AlertTriangle} label="Low Stock Alerts" value={lowStockAlerts.length} color="bg-red-500" link="/inventory" />}
      </div>

      {/* My Tasks */}
      <div className="card">
        <div className="p-4 border-b border-secondary-100 flex items-center justify-between">
          <h2 className="font-semibold text-secondary-900">Pending My Action</h2>
          <Link to="/my-tasks" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
        </div>
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-secondary-500">
            <CheckSquare size={32} className="mx-auto mb-2 text-secondary-300" />
            <p>No pending tasks. You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-100">
            {tasks.slice(0, 5).map(task => (
              <Link key={task.id} to={`/documents/${task.document_id}`} className="flex items-center justify-between p-4 hover:bg-secondary-50">
                <div>
                  <p className="font-medium text-secondary-900 text-sm">{task.title}</p>
                  <p className="text-xs text-secondary-500 mt-0.5">{task.document_number} · {task.step_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-pending">{task.document_type?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-secondary-400">{new Date(task.doc_created_at).toLocaleDateString('en-GB')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-4">
        <h2 className="font-semibold text-secondary-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {hasModule('operations') && <>
            <Link to="/operations/purchase/new" className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
              <Briefcase size={20} className="text-primary-600 mb-2" />
              <span className="text-sm font-medium text-secondary-700">New Purchase Request</span>
            </Link>
            <Link to="/operations/travel/new" className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
              <TrendingUp size={20} className="text-primary-600 mb-2" />
              <span className="text-sm font-medium text-secondary-700">Travel Authorization</span>
            </Link>
          </>}
          {hasModule('assets') && (
            <Link to="/assets" className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
              <Package size={20} className="text-primary-600 mb-2" />
              <span className="text-sm font-medium text-secondary-700">Asset Registry</span>
            </Link>
          )}
          {hasModule('inventory') && (
            <Link to="/inventory/store-requests" className="flex flex-col items-center p-4 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
              <Archive size={20} className="text-primary-600 mb-2" />
              <span className="text-sm font-medium text-secondary-700">Request from Store</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
