import { useState, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import DocumentBodyRenderer from './DocumentBodyRenderer'
import { PenLine, RotateCcw, CheckCircle, Printer } from 'lucide-react'

// ─── One signature/approval block ────────────────────────────────────────────

function SignatureBlock({ step, isMyStep, onSign, signLoading }) {
  const [signing, setSigning] = useState(false)
  const [mode, setMode] = useState('type')
  const [typedName, setTypedName] = useState('')
  const [comments, setComments] = useState('')
  const sigCanvas = useRef(null)

  const sig = step.signature
  const isDone = step.status === 'completed' || step.status === 'approved'

  const submit = () => {
    let signatureData, signatureType
    if (mode === 'type') {
      if (!typedName.trim()) return
      signatureData = typedName
      signatureType = 'typed'
    } else {
      if (!sigCanvas.current || sigCanvas.current.isEmpty()) return
      signatureData = sigCanvas.current.toDataURL('image/png')
      signatureType = 'drawn'
    }
    onSign({ stepId: step.id, signatureData, signatureType, typedName: mode === 'type' ? typedName : undefined, comments })
    setSigning(false)
  }

  const signerName = step.first_name ? `${step.first_name} ${step.last_name}` : step.external_name || 'Pending'

  return (
    <div className={`rounded-xl border overflow-hidden ${isMyStep && !isDone ? 'border-amber-400 ring-2 ring-amber-100' : 'border-secondary-200'}`}>
      {/* Block header */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${isMyStep && !isDone ? 'bg-amber-50 border-b border-amber-200' : 'bg-secondary-50 border-b border-secondary-100'}`}>
        <div>
          <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wider">{step.step_name}</p>
          <p className="text-sm font-semibold text-secondary-800 mt-0.5">{signerName}</p>
        </div>
        {isDone && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle size={11} />{step.action_taken === 'signed' ? 'Signed' : 'Approved'}
          </span>
        )}
      </div>

      {/* Signature area */}
      <div className="p-4 min-h-[90px] flex items-center justify-center bg-white">
        {isDone ? (
          <div className="text-center w-full">
            {sig?.signature_type === 'typed' || sig?.typed_name ? (
              <p style={{ fontFamily: "'Dancing Script', cursive", fontSize: '30px', color: '#1e3a8a', lineHeight: 1.2 }}>
                {sig.typed_name || signerName}
              </p>
            ) : sig?.signature_data && sig.signature_data.startsWith('data:') ? (
              <img src={sig.signature_data} alt="Signature" className="max-h-16 max-w-full mx-auto" />
            ) : (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle size={18} />
                <span className="font-semibold text-sm">{step.action_taken === 'signed' ? 'Signed' : 'Approved'}</span>
              </div>
            )}
            {(sig?.signed_at || step.completed_at) && (
              <p className="text-xs text-secondary-400 mt-1.5">
                {new Date(sig?.signed_at || step.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        ) : isMyStep && !signing ? (
          <button
            onClick={() => setSigning(true)}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-amber-900 font-bold text-sm px-6 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <PenLine size={15} /> SIGN HERE
          </button>
        ) : isMyStep && signing ? (
          <div className="w-full space-y-3">
            {/* Mode tabs */}
            <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg">
              {['type', 'draw'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${mode === m ? 'bg-white text-primary-700 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}
                >
                  {m === 'type' ? 'Type Name' : 'Draw Signature'}
                </button>
              ))}
            </div>

            {mode === 'type' ? (
              <div>
                <input
                  className="input text-sm w-full"
                  placeholder="Type your full legal name"
                  value={typedName}
                  onChange={e => setTypedName(e.target.value)}
                  autoFocus
                />
                {typedName && (
                  <div className="mt-2 py-3 px-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                    <p style={{ fontFamily: "'Dancing Script', cursive", fontSize: '28px', color: '#1e3a8a' }}>
                      {typedName}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="border-2 border-secondary-200 rounded-lg overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={sigCanvas}
                    canvasProps={{ height: 110, className: 'w-full' }}
                    backgroundColor="white"
                    penColor="#1e3a8a"
                  />
                </div>
                <button onClick={() => sigCanvas.current?.clear()} className="mt-1 text-xs text-secondary-400 flex items-center gap-1 hover:text-secondary-600">
                  <RotateCcw size={11} /> Clear
                </button>
              </div>
            )}

            <textarea
              className="input text-xs resize-none w-full"
              rows={2}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Comments (optional)"
            />

            <div className="flex gap-2">
              <button onClick={() => setSigning(false)} className="btn-secondary text-xs flex-1 py-1.5">Cancel</button>
              <button
                onClick={submit}
                disabled={signLoading || (mode === 'type' && !typedName.trim())}
                className="btn-primary text-xs flex-1 py-1.5 flex items-center justify-center gap-1"
              >
                {signLoading
                  ? <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Signing…</>
                  : <><CheckCircle size={13} /> Confirm Signature</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-24 h-0.5 bg-secondary-100 mx-auto mb-2" />
            <p className="text-xs text-secondary-300">Awaiting</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── A4 Document Viewer ───────────────────────────────────────────────────────

export default function DocumentViewer({ doc, record, myStep, onSign, signLoading }) {
  const handlePrint = () => window.print()

  if (!doc) return null

  return (
    <div className="bg-secondary-200 rounded-xl p-4 md:p-8 no-print:bg-secondary-200">
      {/* Print button */}
      <div className="flex justify-end mb-3 no-print">
        <button onClick={handlePrint} className="btn-secondary text-sm flex items-center gap-2">
          <Printer size={14} /> Print / Save PDF
        </button>
      </div>

      {/* A4 paper */}
      <div className="max-w-3xl mx-auto bg-white shadow-2xl" id="document-a4">

        {/* ADESO Letterhead */}
        <div className="bg-primary-800 px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white font-bold text-2xl tracking-tight leading-none">ADESO Africa</p>
              <p className="text-primary-300 text-xs mt-1 tracking-widest uppercase">African Development Solutions</p>
            </div>
            <div className="text-right">
              <p className="text-primary-300 text-xs tracking-wide">Document Reference</p>
              <p className="text-white font-mono font-bold text-xl mt-0.5">{doc.document_number}</p>
              <p className="text-primary-300 text-xs mt-1">
                {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Document Body */}
        <div className="px-8 py-6">
          <DocumentBodyRenderer doc={doc} record={record} />
        </div>

        {/* Signature / Approval section */}
        {doc.steps?.length > 0 && (
          <>
            <div className="mx-8 border-t-2 border-primary-800" />
            <div className="px-8 py-6">
              <p className="text-xs font-bold text-secondary-400 uppercase tracking-widest mb-4">
                Authorisations &amp; Signatures
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doc.steps.map(step => (
                  <SignatureBlock
                    key={step.id}
                    step={step}
                    isMyStep={myStep?.id === step.id}
                    onSign={onSign}
                    signLoading={signLoading}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="bg-secondary-50 border-t border-secondary-100 px-8 py-3">
          <p className="text-xs text-secondary-400 text-center">
            ADESO Africa · {doc.document_number} · Generated by ADESO ERP
          </p>
        </div>
      </div>
    </div>
  )
}
