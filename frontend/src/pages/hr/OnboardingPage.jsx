import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { UserCheck, Paperclip } from 'lucide-react'
import RecordAttachmentsModal from '../../components/common/RecordAttachmentsModal'

function TaskProgress({ tasks = [] }) {
  if (!tasks.length) return null
  const done = tasks.filter(t => t.status === 'completed').length
  const pct = Math.round((done / tasks.length) * 100)
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-secondary-500 mb-1">
        <span>{done}/{tasks.length} tasks</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-secondary-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const [attachingRecord, setAttachingRecord] = useState(null)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => api.get('/hr/onboarding').then(r => r.data),
  })

  const statusColor = {
    pending: 'badge-pending',
    in_progress: 'badge-approved',
    completed: 'badge-approved',
    cancelled: 'badge-rejected',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <UserCheck size={24} className="text-primary-600" />
          Onboarding
        </h1>
        <span className="text-sm text-secondary-500">{records.length} record{records.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}
        {!isLoading && records.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <UserCheck size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">No onboarding records</p>
          </div>
        )}
        {records.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {records.map(rec => (
              <div key={rec.id} className="flex items-start justify-between p-4 hover:bg-secondary-50 gap-3">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0 mt-0.5">
                    {rec.employee_name?.[0] || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-secondary-900 text-sm">{rec.employee_name}</p>
                    <p className="text-xs text-secondary-500 mt-0.5">
                      Start: {rec.start_date
                        ? new Date(rec.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                      {rec.managed_by_name ? ` · Manager: ${rec.managed_by_name}` : ''}
                    </p>
                    <TaskProgress tasks={rec.tasks} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={statusColor[rec.status] || 'badge-draft'}>{rec.status?.replace('_', ' ')}</span>
                  <button
                    onClick={() => setAttachingRecord(rec)}
                    className="p-1.5 rounded hover:bg-secondary-100 text-secondary-400 hover:text-primary-600"
                    title="Attachments"
                  >
                    <Paperclip size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecordAttachmentsModal
        isOpen={!!attachingRecord}
        onClose={() => setAttachingRecord(null)}
        recordType="onboarding"
        recordId={attachingRecord?.id}
        title={attachingRecord?.employee_name}
      />
    </div>
  )
}
