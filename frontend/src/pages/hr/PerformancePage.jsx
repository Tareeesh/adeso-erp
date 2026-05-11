import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Star, TrendingUp, Paperclip } from 'lucide-react'
import RecordAttachmentsModal from '../../components/common/RecordAttachmentsModal'

const TABS = ['All Reviews', 'My Reviews']

const RATING_COLORS = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-yellow-500',
  4: 'text-green-500',
  5: 'text-emerald-600',
}

function RatingStars({ rating }) {
  if (!rating) return <span className="text-secondary-400 text-xs">Not rated</span>
  return (
    <div className={`flex items-center gap-0.5 ${RATING_COLORS[Math.round(rating)] || ''}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={13}
          className={i < Math.round(rating) ? 'fill-current' : 'text-secondary-200 fill-current'}
        />
      ))}
      <span className="text-xs ml-1 text-secondary-600">{Number(rating).toFixed(1)}</span>
    </div>
  )
}

function ReviewList({ reviews, isLoading }) {
  const [attachingRecord, setAttachingRecord] = useState(null)

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
      </div>
    )
  }
  if (!reviews.length) {
    return (
      <div className="p-12 text-center text-secondary-400">
        <TrendingUp size={36} className="mx-auto mb-3 text-secondary-200" />
        <p className="font-medium">No reviews found</p>
      </div>
    )
  }
  return (
    <div className="divide-y divide-secondary-100">
      {reviews.map(rev => (
        <div key={rev.id} className="flex items-center justify-between p-4 hover:bg-secondary-50 gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-semibold text-sm">
              {rev.employee_name?.[0] || '?'}
            </div>
            <div>
              <p className="font-medium text-secondary-900 text-sm">{rev.employee_name}</p>
              <p className="text-xs text-secondary-500 mt-0.5">
                {rev.review_period_start
                  ? new Date(rev.review_period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                  : '?'}
                {' → '}
                {rev.review_period_end
                  ? new Date(rev.review_period_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                  : '?'}
              </p>
              <div className="mt-1"><RatingStars rating={rev.overall_rating} /></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge-${rev.status}`}>{rev.status}</span>
            <button
              onClick={() => setAttachingRecord(rev)}
              className="p-1.5 rounded hover:bg-secondary-100 text-secondary-400 hover:text-primary-600"
              title="Attachments"
            >
              <Paperclip size={15} />
            </button>
          </div>
        </div>
      ))}
      <RecordAttachmentsModal
        isOpen={!!attachingRecord}
        onClose={() => setAttachingRecord(null)}
        recordType="performance_review"
        recordId={attachingRecord?.id}
        title={attachingRecord?.employee_name}
      />
    </div>
  )
}

export default function PerformancePage() {
  const [tab, setTab] = useState(0)

  const { data: allReviews = [], isLoading: loadingAll } = useQuery({
    queryKey: ['performance-all'],
    queryFn: () => api.get('/hr/performance').then(r => r.data),
  })

  const { data: myReviews = [], isLoading: loadingMine } = useQuery({
    queryKey: ['performance-mine'],
    queryFn: () => api.get('/hr/performance/my-reviews').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
        <TrendingUp size={24} className="text-primary-600" />
        Performance Reviews
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
        {tab === 0 && <ReviewList reviews={allReviews} isLoading={loadingAll} />}
        {tab === 1 && <ReviewList reviews={myReviews} isLoading={loadingMine} />}
      </div>
    </div>
  )
}
