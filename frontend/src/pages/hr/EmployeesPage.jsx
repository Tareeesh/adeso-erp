import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Users, Search, Mail, Phone, Paperclip } from 'lucide-react'
import RecordAttachmentsModal from '../../components/common/RecordAttachmentsModal'

export default function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [attachingRecord, setAttachingRecord] = useState(null)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/hr/recruitment/employees').then(r => r.data),
  })

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return (
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.job_title || '').toLowerCase().includes(q) ||
      (e.department_name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
          <Users size={24} className="text-primary-600" />
          Employees
        </h1>
        <span className="text-sm text-secondary-500">{employees.length} total</span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input pl-9"
          placeholder="Search by name, email, job title or department…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="p-12 text-center text-secondary-400">
            <Users size={36} className="mx-auto mb-3 text-secondary-200" />
            <p className="font-medium">{search ? 'No employees match your search' : 'No employees found'}</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="divide-y divide-secondary-100">
            {filtered.map(emp => (
              <div key={emp.id} className="flex items-center justify-between p-4 hover:bg-secondary-50 gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900 text-sm">
                      {emp.first_name} {emp.last_name}
                    </p>
                    <p className="text-xs text-secondary-500">
                      {emp.job_title || '—'}{emp.department_name ? ` · ${emp.department_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1 flex-1">
                  {emp.email && (
                    <p className="text-xs text-secondary-500 flex items-center gap-1 justify-end">
                      <Mail size={11} />{emp.email}
                    </p>
                  )}
                  {emp.phone && (
                    <p className="text-xs text-secondary-500 flex items-center gap-1 justify-end">
                      <Phone size={11} />{emp.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-2 justify-end">
                    {emp.employment_type && (
                      <span className="text-xs bg-secondary-100 text-secondary-600 rounded px-2 py-0.5 capitalize">
                        {emp.employment_type}
                      </span>
                    )}
                    {emp.hire_date && (
                      <span className="text-xs text-secondary-400">
                        Since {new Date(emp.hire_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setAttachingRecord(emp)}
                  className="p-1.5 rounded hover:bg-secondary-100 text-secondary-400 hover:text-primary-600 flex-shrink-0"
                  title="Attachments"
                >
                  <Paperclip size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <RecordAttachmentsModal
        isOpen={!!attachingRecord}
        onClose={() => setAttachingRecord(null)}
        recordType="employee"
        recordId={attachingRecord?.id}
        title={attachingRecord ? `${attachingRecord.first_name} ${attachingRecord.last_name}` : ''}
      />
    </div>
  )
}
