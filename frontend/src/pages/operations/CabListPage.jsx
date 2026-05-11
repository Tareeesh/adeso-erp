import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Car, Plus, MapPin, Clock } from 'lucide-react'

export default function CabListPage() {
  const { data: cabs = [], isLoading } = useQuery({
    queryKey: ['cab-requests'],
    queryFn: () => api.get('/operations/cab').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2"><Car size={24} className="text-primary-600" />Cab Requests</h1>
        <Link to="/operations/cab/new" className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />New Request</Link>
      </div>

      <div className="card">
        {isLoading && <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></div>}
        {!isLoading && cabs.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Car size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No cab requests yet</p>
          </div>
        )}
        {cabs.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {cabs.map(c => (
              <Link key={c.id} to={`/documents/${c.document_id}`} className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Car size={18} className="text-amber-600" /></div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm flex items-center gap-1">
                      <MapPin size={12} className="text-secondary-400" />{c.pickup_location}
                      <span className="text-secondary-300 mx-1">→</span>
                      {c.dropoff_location}
                    </p>
                    <p className="text-xs text-secondary-500 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {c.pickup_datetime ? new Date(c.pickup_datetime).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      {c.passengers > 1 && <> · {c.passengers} passengers</>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`badge-${c.status}`}>{c.status}</span>
                  <p className="text-xs text-secondary-400 mt-1">{c.document_number}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
