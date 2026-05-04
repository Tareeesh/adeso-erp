import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { CheckSquare, Clock, FileText } from 'lucide-react'

export default function MyTasksPage() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/workflows/my-tasks').then(r => r.data),
  })

  const typeLabels = { purchase_requisition: 'Purchase Req.', travel_authorization: 'Travel Auth.', purchase_order: 'LPO', payment_requisition: 'Payment Req.', cab_request: 'Cab Request', recruitment_request: 'Recruitment', offer_letter: 'Offer Letter', asset_assignment: 'Asset Assign.', store_request: 'Store Request' }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckSquare size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-secondary-900">My Tasks</h1>
        <span className="bg-primary-100 text-primary-700 text-sm font-medium px-2.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>

      <div className="card">
        {isLoading && <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" /></div>}

        {!isLoading && tasks.length === 0 && (
          <div className="p-12 text-center">
            <CheckSquare size={40} className="mx-auto text-secondary-200 mb-3" />
            <p className="text-secondary-500 font-medium">No pending tasks</p>
            <p className="text-secondary-400 text-sm mt-1">You're all caught up!</p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {tasks.map(task => (
              <Link key={task.id} to={`/documents/${task.document_id}`} className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <FileText size={18} className="text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900">{task.title}</p>
                    <p className="text-sm text-secondary-500">{task.document_number} · Step: <span className="text-primary-600 font-medium">{task.step_name}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {typeLabels[task.document_type] || task.document_type}
                    </span>
                    <p className="text-xs text-secondary-400 mt-1 flex items-center gap-1 justify-end">
                      <Clock size={11} />{new Date(task.doc_created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
