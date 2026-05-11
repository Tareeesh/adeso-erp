import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Briefcase, Globe, Users, Paperclip } from 'lucide-react'
import RecordAttachmentsModal from '../../components/common/RecordAttachmentsModal'

const TABS = ['Recruitment Requests', 'Job Postings']

export default function RecruitmentPage() {
  const [tab, setTab] = useState(0)
  const [attachingRecord, setAttachingRecord] = useState(null)

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['recruitment-requests'],
    queryFn: () => api.get('/hr/recruitment/requests').then(r => r.data),
  })

  const { data: postings = [], isLoading: loadingPostings } = useQuery({
    queryKey: ['recruitment-postings'],
    queryFn: () => api.get('/hr/recruitment/postings').then(r => r.data),
  })

  const isLoading = tab === 0 ? loadingRequests : loadingPostings

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
        <Briefcase size={24} className="text-primary-600" />
        Recruitment
      </h1>

      <div className="flex border-b border-secondary-200">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === i
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-secondary-500 hover:text-secondary-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card">
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        )}

        {/* Recruitment Requests */}
        {tab === 0 && !loadingRequests && (
          <>
            {requests.length === 0 ? (
              <div className="p-12 text-center text-secondary-400">
                <Users size={36} className="mx-auto mb-3 text-secondary-200" />
                <p className="font-medium">No recruitment requests</p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-100">
                {requests.map(r => (
                  <Link
                    key={r.id}
                    to={`/documents/${r.document_id}`}
                    className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Users size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-secondary-900 text-sm">{r.position_title}</p>
                        <p className="text-xs text-secondary-500 mt-0.5">
                          {r.department}{r.employment_type ? ` · ${r.employment_type}` : ''}
                          {r.vacancies ? ` · ${r.vacancies} ${r.vacancies === 1 ? 'vacancy' : 'vacancies'}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`badge-${r.status}`}>{r.status}</span>
                      {r.document_number && (
                        <p className="text-xs text-secondary-400 mt-1">{r.document_number}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Job Postings */}
        {tab === 1 && !loadingPostings && (
          <>
            {postings.length === 0 ? (
              <div className="p-12 text-center text-secondary-400">
                <Globe size={36} className="mx-auto mb-3 text-secondary-200" />
                <p className="font-medium">No job postings</p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-100">
                {postings.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-secondary-50 gap-3">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Globe size={18} className="text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-secondary-900 text-sm">{p.title}</p>
                        <p className="text-xs text-secondary-500 mt-0.5">
                          {p.location}{p.employment_type ? ` · ${p.employment_type}` : ''}
                          {p.closing_date
                            ? ` · Closes ${new Date(p.closing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className={`badge-${p.status}`}>{p.status}</span>
                        {p.application_count != null && (
                          <p className="text-xs text-secondary-400 mt-1">
                            {p.application_count} application{p.application_count !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setAttachingRecord(p)}
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
          </>
        )}
      </div>
      <RecordAttachmentsModal
        isOpen={!!attachingRecord}
        onClose={() => setAttachingRecord(null)}
        recordType="job_posting"
        recordId={attachingRecord?.id}
        title={attachingRecord?.title}
      />
    </div>
  )
}
