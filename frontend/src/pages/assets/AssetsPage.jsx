import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Package, Search, Filter } from 'lucide-react'

const CONDITION_COLOR = {
  new: 'bg-emerald-50 text-emerald-700',
  good: 'bg-green-50 text-green-700',
  fair: 'bg-yellow-50 text-yellow-700',
  poor: 'bg-orange-50 text-orange-700',
  damaged: 'bg-red-50 text-red-700',
  disposed: 'bg-secondary-100 text-secondary-500',
}

export default function AssetsPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets').then(r => r.data),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => api.get('/assets/categories').then(r => r.data),
  })

  const filtered = assets.filter(a => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (a.name || '').toLowerCase().includes(q) ||
      (a.asset_id_code || '').toLowerCase().includes(q) ||
      (a.brand || '').toLowerCase().includes(q) ||
      (a.model || '').toLowerCase().includes(q) ||
      (a.assigned_to_name || '').toLowerCase().includes(q)
    const matchCat = !categoryId || String(a.category_id) === categoryId
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <Package size={24} className="text-primary-600" />
          Asset Registry
        </h1>
        <span className="text-sm text-secondary-500">{assets.length} assets</span>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, code, brand or model…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-secondary-400" />
          <select
            className="input w-48"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Package size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">{search || categoryId ? 'No assets match your filters' : 'No assets found'}</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {filtered.map(a => (
              <Link
                key={a.id}
                to={`/assets/${a.id}`}
                className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
                    <Package size={18} className="text-secondary-500" />
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">{a.name}</p>
                    <p className="text-xs text-secondary-500 mt-0.5">
                      {a.asset_id_code}
                      {a.brand ? ` · ${a.brand}` : ''}
                      {a.model ? ` ${a.model}` : ''}
                      {a.category_name ? ` · ${a.category_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-2 justify-end">
                    {a.condition && (
                      <span className={`text-xs rounded px-2 py-0.5 capitalize font-medium ${CONDITION_COLOR[a.condition] || 'bg-secondary-100 text-secondary-600'}`}>
                        {a.condition}
                      </span>
                    )}
                    <span className={`badge-${a.status}`}>{a.status}</span>
                  </div>
                  {a.assigned_to_name ? (
                    <p className="text-xs text-secondary-500">{a.assigned_to_name}</p>
                  ) : a.office_location ? (
                    <p className="text-xs text-secondary-400">{a.office_location}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
