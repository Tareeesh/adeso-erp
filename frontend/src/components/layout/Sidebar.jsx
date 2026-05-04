import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Briefcase, Users, Package, Archive,
  Settings, CheckSquare, ChevronDown, ChevronRight, Building2
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'My Tasks', icon: CheckSquare, path: '/my-tasks' },
  {
    label: 'Operations', icon: Briefcase, module: 'operations',
    children: [
      { label: 'Purchase Requests', path: '/operations/purchase' },
      { label: 'Travel Authorization', path: '/operations/travel' },
      { label: 'Cab Requests', path: '/operations/cab' },
    ]
  },
  {
    label: 'Human Resources', icon: Users, module: 'hr',
    children: [
      { label: 'Employees', path: '/hr/employees' },
      { label: 'Recruitment', path: '/hr/recruitment' },
      { label: 'Onboarding', path: '/hr/onboarding' },
      { label: 'Performance', path: '/hr/performance' },
    ]
  },
  {
    label: 'Asset Registry', icon: Package, module: 'assets',
    children: [
      { label: 'All Assets', path: '/assets' },
    ]
  },
  {
    label: 'Inventory', icon: Archive, module: 'inventory',
    children: [
      { label: 'Stock Items', path: '/inventory' },
      { label: 'Store Requests', path: '/inventory/store-requests' },
      { label: 'Warehouses', path: '/inventory/warehouses' },
    ]
  },
  {
    label: 'Administration', icon: Settings, adminOnly: true,
    children: [
      { label: 'Companies', path: '/admin/companies' },
      { label: 'Users & Roles', path: '/admin/users' },
      { label: 'System Settings', path: '/admin' },
    ]
  },
]

export default function Sidebar({ open }) {
  const { hasModule, hasRole, activeCompany, user } = useAuth()
  const [expanded, setExpanded] = useState({ Operations: true })

  const toggle = (label) => setExpanded(p => ({ ...p, [label]: !p[label] }))

  const isVisible = (item) => {
    if (item.adminOnly) return user?.is_global_admin || hasRole('company_admin', 'global_admin')
    if (item.module) return hasModule(item.module)
    return true
  }

  if (!open) return (
    <div className="w-16 bg-secondary-900 flex flex-col items-center py-4 gap-4">
      {NAV.filter(isVisible).map(item => (
        <div key={item.label} title={item.label} className="p-2 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-700 cursor-pointer">
          <item.icon size={20} />
        </div>
      ))}
    </div>
  )

  return (
    <div className="w-64 bg-secondary-900 flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="p-4 border-b border-secondary-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm truncate">{activeCompany?.company_name || 'ERP System'}</p>
            <p className="text-secondary-400 text-xs truncate">{activeCompany?.role_display || ''}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.filter(isVisible).map(item => (
          <div key={item.label}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-secondary-300 hover:text-white hover:bg-secondary-800 transition-colors text-sm"
                >
                  <span className="flex items-center gap-2">
                    <item.icon size={16} />
                    {item.label}
                  </span>
                  {expanded[item.label] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {expanded[item.label] && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) => clsx(
                          'block px-3 py-1.5 rounded-lg text-sm transition-colors',
                          isActive ? 'bg-primary-600 text-white' : 'text-secondary-400 hover:text-white hover:bg-secondary-800'
                        )}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <NavLink
                to={item.path}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-primary-600 text-white' : 'text-secondary-300 hover:text-white hover:bg-secondary-800'
                )}
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            )}
          </div>
        ))}
      </nav>
    </div>
  )
}
