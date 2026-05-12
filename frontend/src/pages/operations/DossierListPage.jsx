import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { FolderCheck, CheckCircle, FolderOpen } from 'lucide-react'

export default function DossierListPage() {
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['dossiers'],
    queryFn: () => api.get('/operations/dossier').then(r => r.data),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-secondary-900">Dossier Closure</h1>
        <p className="text-sm text-secondary-500 mt-0.5">Close and archive completed procurement cases</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" /></div>
      ) : dossiers.length === 0 ? (
        <div className="card p-10 text-center">
          <FolderCheck size={36} className="mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-500 font-medium">No dossiers yet</p>
          <p className="text-secondary-400 text-sm mt-1">Open a Purchase Order and use the Dossier Closure action to archive a case</p>
          <Link to="/operations/orders" className="btn-primary text-sm mt-4 inline-flex items-center gap-2">
            <FolderOpen size={14} /> Go to Purchase Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {dossiers.map(d => (
            <div key={d.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FolderCheck size={20} className={`flex-shrink-0 mt-0.5 ${d.all_checked ? 'text-green-600' : 'text-secondary-400'}`} />
                <div className="min-w-0">
                  <p className="font-semibold text-secondary-900 truncate">{d.doc_title || d.document_number}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-secondary-400">
                    <span>{d.document_number}</span>
                    <span>·</span>
                    <span>{new Date(d.closed_at).toLocaleDateString('en-GB')}</span>
                    <span>·</span>
                    <span>By {d.closed_by_name}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {d.all_checked
                  ? <span className="badge-completed flex items-center gap-1"><CheckCircle size={12} /> Complete</span>
                  : <span className="badge-progress">In Progress</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
