import { Plus, Trash2, Users, Mail } from 'lucide-react'

// steps: [{ stepName, type: 'internal'|'external', userId, externalName, externalEmail }]
// onChange: (steps) => void
// users: [{ id, first_name, last_name }]
export default function ApprovalChainBuilder({ steps, onChange, users = [] }) {
  const update = (i, patch) => onChange(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const remove = (i) => onChange(steps.filter((_, idx) => idx !== i))
  const add = () => onChange([...steps, { stepName: '', type: 'internal', userId: '', externalName: '', externalEmail: '' }])

  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-semibold text-secondary-900">Approval Chain</h2>
      <p className="text-xs text-secondary-500">Add internal approvers (from your team) or external signatories who will receive a secure email link — no account required.</p>

      {steps.map((step, i) => (
        <div key={i} className="border border-secondary-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Step {i + 1}</span>
            {steps.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div>
            <label className="label text-xs">Step Label</label>
            <input
              className="input text-sm"
              placeholder="e.g. Line Manager Approval"
              value={step.stepName}
              onChange={e => update(i, { stepName: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update(i, { type: 'internal', externalName: '', externalEmail: '' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                step.type === 'internal'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-secondary-600 border-secondary-300 hover:border-primary-400'
              }`}
            >
              <Users size={12} /> Internal User
            </button>
            <button
              type="button"
              onClick={() => update(i, { type: 'external', userId: '' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                step.type === 'external'
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-secondary-600 border-secondary-300 hover:border-primary-400'
              }`}
            >
              <Mail size={12} /> External (Email Link)
            </button>
          </div>

          {step.type === 'internal' ? (
            <div>
              <label className="label text-xs">Assigned To</label>
              <select
                className="input text-sm"
                value={step.userId}
                onChange={e => update(i, { userId: e.target.value })}
              >
                <option value="">Select approver…</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}{u.job_title ? ` — ${u.job_title}` : ''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Signatory Full Name</label>
                <input
                  className="input text-sm"
                  placeholder="Full name"
                  value={step.externalName}
                  onChange={e => update(i, { externalName: e.target.value })}
                />
              </div>
              <div>
                <label className="label text-xs">Email Address</label>
                <input
                  type="email"
                  className="input text-sm"
                  placeholder="signatory@example.com"
                  value={step.externalEmail}
                  onChange={e => update(i, { externalEmail: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="btn-secondary text-sm flex items-center gap-1"
      >
        <Plus size={14} /> Add Step
      </button>
    </div>
  )
}
