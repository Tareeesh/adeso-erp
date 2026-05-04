import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [companies, setCompanies] = useState([])
  const [activeCompany, setActiveCompany] = useState(null)
  const [accessibleModules, setAccessibleModules] = useState([])
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
      setCompanies(data.companies)
      setAccessibleModules(data.accessibleModules)
      const stored = localStorage.getItem('activeCompanyId')
      const active = data.companies.find(c => c.company_id === stored) || data.companies[0]
      if (active) setActiveCompany(active)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) { loadProfile() } else { setLoading(false) }
  }, [loadProfile])

  const login = async (email, password, companyId) => {
    const { data } = await api.post('/auth/login', { email, password, companyId })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    if (data.activeCompanyId) localStorage.setItem('activeCompanyId', data.activeCompanyId)
    setUser(data.user)
    setCompanies(data.companies)
    const active = data.companies.find(c => c.company_id === data.activeCompanyId) || data.companies[0]
    if (active) setActiveCompany(active)
    await loadProfile()
    return data
  }

  const logout = async () => {
    try { await api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }) } catch {}
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('activeCompanyId')
    setUser(null)
    setCompanies([])
    setActiveCompany(null)
    setAccessibleModules([])
  }

  const switchCompany = async (companyId) => {
    const { data } = await api.post('/auth/switch-company', { companyId })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('activeCompanyId', companyId)
    await loadProfile()
  }

  const hasModule = (code) => {
    if (user?.is_global_admin) return true
    return accessibleModules.some(m => m.code === code)
  }

  const hasRole = (...roles) => {
    if (user?.is_global_admin) return true
    return roles.includes(activeCompany?.role_name)
  }

  return (
    <AuthContext.Provider value={{ user, companies, activeCompany, accessibleModules, loading, login, logout, switchCompany, hasModule, hasRole, loadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
