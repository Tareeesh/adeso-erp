import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import SignatureCanvas from 'react-signature-canvas'
import api from '../../services/api'
import DocumentBodyRenderer from '../../components/documents/DocumentBodyRenderer'
import { CheckCircle, FileText, AlertCircle, PenLine, RotateCcw, Printer } from 'lucide-react'

export default function ExternalSignPage() {
  const { token } = useParams()
  const [mode, setMode] = useState('type')
  const [typedName, setTypedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [done, setDone] = useState(false)
  const [signerName, setSignerName] = useState('')
  const sigCanvas = useRef(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['external-sign', token],
    queryFn: () => api.get(`/sign/${token}`).then(r => r.data),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: () => {
      let signatureData, signatureType
      if (mode === 'type') {
        signatureData = typedName
        signatureType = 'typed'
      } else {
        signatureData = sigCanvas.current?.toDataURL('image/png') || ''
        signatureType = 'drawn'
      }
      return api.post(`/sign/${token}`, { typedName: typedName || data?.step?.externalName, signatureData, signatureType })
    },
    onSuccess: () => { setSignerName(typedName || data?.step?.externalName || ''); setDone(true) },
  })

  const canSign = agreed && (mode === 'type' ? typedName.trim().length >= 2 : true)

  if (isLoading) return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700" />
    </div>
  )

  if (error) {
    const alreadySigned = error.response?.data?.error === 'already_signed'
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-secondary-200 p-8 text-center space-y-4">
          {alreadySigned ? <CheckCircle size={52} className="mx-auto text-green-500" /> : <AlertCircle size={52} className="mx-auto text-red-400" />}
          <h1 className="text-xl font-bold">{alreadySigned ? 'Already Signed' : 'Link Not Available'}</h1>
          <p className="text-secondary-500 text-sm">{error.response?.data?.message || 'This signing link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  if (done) return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-secondary-200 p-8 text-center space-y-4">
        <CheckCircle size={60} className="mx-auto text-green-500" />
        <h1 className="text-2xl font-bold text-secondary-900">Document Signed</h1>
        <p className="text-secondary-600">Thank you, <strong>{signerName}</strong>. Your signature has been recorded and the workflow has advanced.</p>
        {typedName && (
          <div className="py-3 px-6 bg-blue-50 rounded-xl border border-blue-100">
            <p style={{ fontFamily: "'Dancing Script', cursive", fontSize: '32px', color: '#1e3a8a' }}>{typedName}</p>
          </div>
        )}
        <p className="text-xs text-secondary-400">You can safely close this window.</p>
      </div>
    </div>
  )

  const { step, document: doc, record } = data

  return (
    <div className="min-h-screen bg-secondary-100">
      {/* Header bar */}
      <div className="bg-primary-800 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} />
          <span className="font-bold text-sm">ADESO ERP · Secure Document Signing</span>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-xs text-primary-200 hover:text-white transition-colors">
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        {/* Signing request notice */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <PenLine size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">You have been requested to sign this document</p>
            <p className="text-amber-700 text-sm mt-0.5">
              Step: <strong>{step.stepName}</strong> · Requested as: <strong>{step.externalName}</strong>
            </p>
          </div>
        </div>

        {/* A4 Document */}
        <div className="bg-secondary-200 rounded-xl p-4 md:p-8">
          <div className="max-w-3xl mx-auto bg-white shadow-2xl" id="document-a4">
            {/* Letterhead */}
            <div className="bg-primary-800 px-8 py-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-bold text-2xl tracking-tight">ADESO Africa</p>
                  <p className="text-primary-300 text-xs mt-1 tracking-widest uppercase">African Development Solutions</p>
                </div>
                <div className="text-right">
                  <p className="text-primary-300 text-xs">Document Reference</p>
                  <p className="text-white font-mono font-bold text-xl mt-0.5">{doc.document_number}</p>
                  <p className="text-primary-300 text-xs mt-1">
                    {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Document body */}
            <div className="px-8 py-6">
              {record && Object.keys(record).length > 0
                ? <DocumentBodyRenderer doc={doc} record={record} />
                : <p className="text-secondary-400 text-sm">Loading document content…</p>}
            </div>

            {/* Signature area */}
            <div className="mx-8 border-t-2 border-primary-800" />
            <div className="px-8 py-6">
              <p className="text-xs font-bold text-secondary-400 uppercase tracking-widest mb-4">Your Signature</p>

              <div className="border-2 border-amber-400 ring-2 ring-amber-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">{step.stepName}</p>
                  <p className="text-sm font-semibold text-secondary-800 mt-0.5">{step.externalName}</p>
                </div>

                <div className="p-4 bg-white space-y-3">
                  {/* Mode tabs */}
                  <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg">
                    {['type', 'draw'].map(m => (
                      <button key={m} onClick={() => setMode(m)}
                        className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${mode === m ? 'bg-white text-primary-700 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}
                      >
                        {m === 'type' ? 'Type Name' : 'Draw Signature'}
                      </button>
                    ))}
                  </div>

                  {mode === 'type' ? (
                    <div>
                      <label className="label">Type your full legal name *</label>
                      <input
                        className="input text-base"
                        placeholder="Your full name"
                        value={typedName}
                        onChange={e => setTypedName(e.target.value)}
                        autoFocus
                      />
                      {typedName && (
                        <div className="mt-3 py-4 px-6 bg-blue-50 rounded-xl border border-blue-100 text-center">
                          <p style={{ fontFamily: "'Dancing Script', cursive", fontSize: '32px', color: '#1e3a8a' }}>
                            {typedName}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="label">Draw your signature</label>
                      <div className="border-2 border-secondary-200 rounded-xl overflow-hidden bg-white">
                        <SignatureCanvas
                          ref={sigCanvas}
                          canvasProps={{ height: 130, className: 'w-full' }}
                          backgroundColor="white"
                          penColor="#1e3a8a"
                        />
                      </div>
                      <button onClick={() => sigCanvas.current?.clear()} className="mt-1.5 text-sm text-secondary-400 flex items-center gap-1 hover:text-secondary-600">
                        <RotateCcw size={13} /> Clear
                      </button>
                    </div>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer mt-2">
                    <input type="checkbox" className="mt-0.5 rounded" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                    <span className="text-sm text-secondary-600">
                      I confirm that I have read and reviewed this document in full, and that my signature above constitutes my legal electronic signature and approval of its contents.
                    </span>
                  </label>

                  <button
                    onClick={() => mutation.mutate()}
                    disabled={!canSign || mutation.isPending}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                  >
                    {mutation.isPending
                      ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Signing…</>
                      : <><CheckCircle size={16} /> Sign Document</>}
                  </button>

                  {mutation.isError && (
                    <p className="text-red-600 text-sm text-center">{mutation.error?.response?.data?.error || 'Signing failed. Please try again.'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-secondary-50 border-t border-secondary-100 px-8 py-3">
              <p className="text-xs text-secondary-400 text-center">
                This link is unique to you and expires once used · Secured by ADESO ERP
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
