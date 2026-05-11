import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import { CheckCircle, FileText, AlertCircle, PenLine } from 'lucide-react'

export default function ExternalSignPage() {
  const { token } = useParams()
  const [typedName, setTypedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [done, setDone] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['external-sign', token],
    queryFn: () => api.get(`/sign/${token}`).then(r => r.data),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: () => api.post(`/sign/${token}`, { typedName }),
    onSuccess: () => setDone(true),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error) {
    const msg = error.response?.data?.message || error.response?.data?.error || 'This signing link is invalid or has already been used.'
    const alreadySigned = error.response?.data?.error === 'already_signed'
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-secondary-200 p-8 text-center space-y-4">
          {alreadySigned ? (
            <CheckCircle size={48} className="mx-auto text-green-500" />
          ) : (
            <AlertCircle size={48} className="mx-auto text-red-400" />
          )}
          <h1 className="text-xl font-bold text-secondary-900">
            {alreadySigned ? 'Already Signed' : 'Link Not Available'}
          </h1>
          <p className="text-secondary-600 text-sm">{msg}</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-secondary-200 p-8 text-center space-y-4">
          <CheckCircle size={56} className="mx-auto text-green-500" />
          <h1 className="text-2xl font-bold text-secondary-900">Document Signed</h1>
          <p className="text-secondary-600">Thank you, <strong>{typedName}</strong>. Your signature has been recorded and the document workflow has advanced.</p>
          <p className="text-xs text-secondary-400">You can close this window.</p>
        </div>
      </div>
    )
  }

  const { step, document: doc } = data

  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-primary-700 font-bold text-lg mb-1">
            <FileText size={22} /> ADESO ERP
          </div>
          <p className="text-secondary-500 text-sm">Secure Document Signing</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 space-y-4">
          <div className="bg-secondary-50 rounded-lg p-4 space-y-1">
            <p className="text-xs text-secondary-500 uppercase tracking-wide font-medium">Document</p>
            <p className="font-semibold text-secondary-900">{doc.title}</p>
            <p className="text-sm text-secondary-500">Ref: {doc.documentNumber}</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              You have been requested to sign as <strong>{step.externalName || 'Signatory'}</strong> for the step: <strong>{step.stepName}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">Type your full name to sign *</label>
              <div className="relative">
                <PenLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                <input
                  className="input pl-9 font-medium"
                  placeholder="Your full legal name"
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                  autoFocus
                />
              </div>
              {typedName && (
                <div className="mt-2 p-3 border-2 border-secondary-300 rounded-lg bg-secondary-50">
                  <p className="font-['Georgia',serif] text-2xl text-secondary-700 italic">{typedName}</p>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
              />
              <span className="text-sm text-secondary-600">
                I agree that typing my name above constitutes my legal electronic signature on this document, and that I have reviewed and approve its contents.
              </span>
            </label>
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={!typedName.trim() || !agreed || mutation.isPending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Signing…</>
            ) : (
              <><CheckCircle size={16} /> Sign Document</>
            )}
          </button>

          {mutation.isError && (
            <p className="text-red-600 text-sm text-center">{mutation.error?.response?.data?.error || 'Failed to sign. Please try again.'}</p>
          )}
        </div>

        <p className="text-center text-xs text-secondary-400">
          This link is unique to you and will expire once used. Secured by ADESO ERP.
        </p>
      </div>
    </div>
  )
}
