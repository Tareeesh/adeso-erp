import { Check, Clock, X, ArrowRight } from 'lucide-react'
import clsx from 'clsx'

const stepIcon = (status) => {
  if (status === 'completed') return <Check size={14} />
  if (status === 'rejected') return <X size={14} />
  if (status === 'in_progress') return <Clock size={14} />
  return null
}

const stepColor = (status) => ({
  completed: 'bg-green-500 border-green-500 text-white',
  rejected: 'bg-red-500 border-red-500 text-white',
  in_progress: 'bg-primary-600 border-primary-600 text-white animate-pulse',
  pending: 'bg-white border-secondary-300 text-secondary-400',
  skipped: 'bg-secondary-200 border-secondary-200 text-secondary-500',
}[status] || 'bg-white border-secondary-300 text-secondary-400')

export default function WorkflowTracker({ steps = [] }) {
  return (
    <div className="py-4">
      <div className="flex items-start gap-0">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-start flex-1">
            <div className="flex flex-col items-center">
              <div className={clsx('w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold', stepColor(step.status))}>
                {stepIcon(step.status) || (i + 1)}
              </div>
              <div className="mt-2 text-center px-1">
                <p className="text-xs font-medium text-secondary-700 leading-tight">{step.step_name}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{step.first_name} {step.last_name}</p>
                {step.completed_at && (
                  <p className="text-xs text-secondary-400">{new Date(step.completed_at).toLocaleDateString('en-GB')}</p>
                )}
                {step.status === 'rejected' && step.comments && (
                  <p className="text-xs text-red-500 mt-0.5 italic">{step.comments}</p>
                )}
                {step.signed_at && (
                  <p className="text-xs text-green-600 mt-0.5">Signed</p>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mt-4 flex items-center px-1">
                <div className={clsx('flex-1 h-0.5', step.status === 'completed' ? 'bg-green-400' : 'bg-secondary-200')} />
                <ArrowRight size={12} className={step.status === 'completed' ? 'text-green-400' : 'text-secondary-300'} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
