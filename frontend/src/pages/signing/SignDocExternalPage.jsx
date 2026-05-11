import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import SignatureCanvas from 'react-signature-canvas'
import api from '../../services/api'
import { CheckCircle, AlertCircle, PenLine, RotateCcw, FileText } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const PAGE_WIDTH = 700

const FIELD_COLOR = {
  bg: 'rgba(245,158,11,0.15)',
  border: '#f59e0b',
}

export default function SignDocExternalPage() {
  const { token } = useParams()
  const [numPages, setNumPages] = useState(0)
  const [mode, setMode] = useState('type')
  const [typedName, setTypedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [done, setDone] = useState(false)
  const sigCanvas = useRef(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['sign-ext', token],
    queryFn: () => api.get(`/sign-ext/${token}`).then(r => r.data),
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: () => {
      let signatureData, signatureType
      if (mode === 'type') {
        signatureData = typedName.trim()
        signatureType = 'typed'
      } else {
        signatureData = sigCanvas.current?.toDataURL('image/png') || ''
        signatureType = 'drawn'
      }
      return api.post(`/sign-ext/${token}`, {
        signatureData,
        signatureType,
        typedName: mode === 'type' ? typedName.trim() : undefined,
      })
    },
    onSuccess: () => setDone(true),
  })

  const canSign = agreed && (mode === 'type' ? typedName.trim().length >= 2 : true)

  if (isLoading) return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700" />
    </div>
  )

  if (error) {
    const alreadySigned = error.response?.data?.error === 'already_signed'
    const notReady = error.response?.data?.error === 'not_ready'
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-secondary-200 p-8 text-center space-y-4">
          {alreadySigned ? <CheckCircle size={52} className="mx-auto text-green-500" /> : <AlertCircle size={52} className="mx-auto text-red-400" />}
          <h1 className="text-xl font-bold">
            {alreadySigned ? 'Already Signed' : notReady ? 'Not Ready Yet' : 'Link Not Available'}
          </h1>
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
        <p className="text-secondary-600">
          Thank you, <strong>{data?.recipient?.name}</strong>. Your signature has been recorded.
        </p>
        {mode === 'type' && typedName && (
          <div className="py-3 px-6 bg-blue-50 rounded-xl border border-blue-100">
            <p style={{ fontFamily: "'Dancing Script', cursive", fontSize: '32px', color: '#1e3a8a' }}>{typedName}</p>
          </div>
        )}
        <p className="text-xs text-secondary-400">You can safely close this window.</p>
      </div>
    </div>
  )

  const { recipient, documentTitle, fileUrl, fields = [] } = data

  return (
    <div className="min-h-screen bg-secondary-100">
      {/* Header */}
      <div className="bg-primary-800 text-white px-6 py-3 flex items-center gap-2">
        <FileText size={18} />
        <span className="font-bold text-sm">ADESO ERP · Secure Document Signing</span>
      </div>

      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        {/* Notice */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <PenLine size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">You have been requested to sign this document</p>
            <p className="text-amber-700 text-sm mt-0.5">
              Signing as: <strong>{recipient.name}</strong> ({recipient.email})
            </p>
            <p className="text-amber-700 text-sm">Document: <strong>{documentTitle}</strong></p>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="bg-secondary-200 rounded-xl p-4">
          <p className="text-xs text-secondary-500 mb-3 text-center">Please review the full document before signing</p>
          <div className="flex justify-center">
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => {
                const pageFields = fields.filter(f => f.page_number === pageNum)
                return (
                  <div key={pageNum} className="mb-4">
                    <p className="text-xs text-secondary-400 mb-1.5 text-center">Page {pageNum}</p>
                    <div className="relative inline-block shadow-xl">
                      <Page
                        pageNumber={pageNum}
                        width={PAGE_WIDTH}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                      />
                      {pageFields.map(f => (
                        <div
                          key={f.id}
                          style={{
                            position: 'absolute',
                            left: `${f.x_pct}%`,
                            top: `${f.y_pct}%`,
                            width: `${f.w_pct}%`,
                            height: `${f.h_pct}%`,
                            background: FIELD_COLOR.bg,
                            border: `2px solid ${FIELD_COLOR.border}`,
                            borderRadius: '3px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ fontSize: '10px', color: '#92400e', fontWeight: 600 }}>✍ Sign Here</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </Document>
          </div>
        </div>

        {/* Signing panel */}
        <div className="bg-white rounded-xl border-2 border-amber-400 ring-2 ring-amber-100 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200">
            <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide">Your Signature</p>
            <p className="font-semibold text-secondary-800 mt-0.5">{recipient.name}</p>
          </div>

          <div className="p-5 space-y-4">
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

            <label className="flex items-start gap-3 cursor-pointer">
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
              <p className="text-red-600 text-sm text-center">
                {mutation.error?.response?.data?.message || 'Signing failed. Please try again.'}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-secondary-400 text-center">
          This link is unique to you and expires once used · Secured by ADESO ERP
        </p>
      </div>
    </div>
  )
}
