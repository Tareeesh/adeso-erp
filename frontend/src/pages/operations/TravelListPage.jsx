import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Plane, Plus, MapPin, Calendar } from 'lucide-react'

export default function TravelListPage() {
  const { data: travel = [], isLoading } = useQuery({
    queryKey: ['travel-authorizations'],
    queryFn: () => api.get('/operations/travel').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2"><Plane size={24} className="text-primary-600" />Travel Authorization</h1>
        <Link to="/operations/travel/new" className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />New Request</Link>
      </div>

      <div className="card">
        {isLoading && <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></div>}
        {!isLoading && travel.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Plane size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No travel requests yet</p>
            <p className="text-sm mt-1">Submit a travel authorization to get started</p>
          </div>
        )}
        {travel.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {travel.map(t => (
              <Link key={t.id} to={`/documents/${t.document_id}`} className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Plane size={18} className="text-blue-600" /></div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">{t.traveler_name}</p>
                    <p className="text-xs text-secondary-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={11} />{t.destination}
                      <span className="mx-1">·</span>
                      <Calendar size={11} />{t.departure_date ? new Date(t.departure_date).toLocaleDateString('en-GB') : '—'}
                      {t.return_date && <> — {new Date(t.return_date).toLocaleDateString('en-GB')}</>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`badge-${t.status}`}>{t.status}</span>
                  <p className="text-xs text-secondary-400 mt-1">{t.document_number}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
