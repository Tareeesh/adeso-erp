import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Warehouse, MapPin, User } from 'lucide-react'

export default function WarehousesPage() {
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/inventory/warehouses').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <Warehouse size={24} className="text-primary-600" />
          Warehouses
        </h1>
        <span className="text-sm text-secondary-500">{warehouses.length} location{warehouses.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}
        {!isLoading && warehouses.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Warehouse size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No warehouses configured</p>
          </div>
        )}
        {warehouses.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {warehouses.map(w => (
              <div key={w.id} className="flex items-center justify-between p-4 hover:bg-secondary-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                    <Warehouse size={18} className="text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">{w.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {w.location && (
                        <p className="text-xs text-secondary-500 flex items-center gap-1">
                          <MapPin size={11} />{w.location}
                        </p>
                      )}
                      {w.manager_name && (
                        <p className="text-xs text-secondary-500 flex items-center gap-1">
                          <User size={11} />{w.manager_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  {w.is_active ? (
                    <span className="text-xs bg-emerald-50 text-emerald-700 rounded px-2 py-0.5 font-medium">Active</span>
                  ) : (
                    <span className="text-xs bg-secondary-100 text-secondary-500 rounded px-2 py-0.5">Inactive</span>
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
