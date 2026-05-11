import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import api from '../../services/api'
import { toast } from 'react-toastify'
import {
  ArrowLeft, Plus, Trash2, Send, Save, Users, CheckCircle, Clock,
  Download, UserPlus, X, Info,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const PAGE_WIDTH = 740
const MIN_FIELD_W = 3
const MIN_FIELD_H = 1.5

const COLORS = [
  { bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', text: '#1d4ed8', pill: 'bg-blue-100 text-blue-700 border-blue-300' },
  { bg: 'rgba(34,197,94,0.18)', border: '#22c55e', text: '#15803d', pill: 'bg-green-100 text-green-700 border-green-300' },
  { bg: 'rgba(249,115,22,0.18)', border: '#f97316', text: '#c2410c', pill: 'bg-orange-100 text-orange-700 border-orange-300' },
  { bg: 'rgba(168,85,247,0.18)', border: '#a855f7', text: '#7e22ce', pill: 'bg-purple-100 text-purple-700 border-purple-300' },
  { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#be185d', pill: 'bg-pink-100 text-pink-700 border-pink-300' },
]

let fieldIdCounter = 0
const nextId = () => ++fieldIdCounter

export default function SignDocPreparePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [numPages, setNumPages] = useState(0)
  const [recipients, setRecipients] = useState([]) // { name, email, order_num }
  const [fields, setFields] = useState([]) // { _id, recipient_index, page_number, x_pct, y_pct, w_pct, h_pct }
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [dragState, setDragState] = useState(null) // { pageNum, startX, startY, curX, curY }
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const pageRefs = useRef({})

  const { data: doc, isLoading } = useQuery({
    queryKey: ['sign-doc', id],
    queryFn: () => api.get(`/sign-docs/${id}`).then(r => r.data),
    onSuccess: (d) => {
      if (d.recipients?.length > 0 && recipients.length === 0) {
        setRecipients(d.recipients.map(r => ({ name: r.name, email: r.email, order_num: r.order_num })))
        setFields((d.fields || []).map((f, i) => ({
          _id: nextId(),
          recipient_index: d.recipients.findIndex(r => r.id === f.recipient_id),
          page_number: f.page_number,
          x_pct: f.x_pct, y_pct: f.y_pct, w_pct: f.w_pct, h_pct: f.h_pct,
        })))
      }
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/sign-docs/${id}/recipients`, {
      recipients,
      fields: fields.map(f => ({
        recipient_index: f.recipient_index,
        page_number: f.page_number,
        x_pct: f.x_pct, y_pct: f.y_pct, w_pct: f.w_pct, h_pct: f.h_pct,
      })),
    }),
    onSuccess: () => { toast.success('Saved'); setSaved(true); qc.invalidateQueries(['sign-doc', id]) },
    onError: err => toast.error(err.response?.data?.error || 'Save failed'),
  })

  const sendMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync()
      return api.post(`/sign-docs/${id}/send`)
    },
    onSuccess: () => { toast.success('Sent for signing!'); qc.invalidateQueries(['sign-docs']); navigate('/signing') },
    onError: err => toast.error(err.response?.data?.error || 'Send failed'),
  })

  const addRecipient = () => {
    if (!newName.trim() || !newEmail.trim()) return toast.error('Enter name and email')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) return toast.error('Enter a valid email')
    if (recipients.length >= COLORS.length) return toast.error('Maximum 5 recipients')
    setRecipients(prev => [...prev, { name: newName.trim(), email: newEmail.trim().toLowerCase(), order_num: prev.length + 1 }])
    setSelectedIdx(recipients.length)
    setNewName('')
    setNewEmail('')
    setSaved(false)
  }

  const removeRecipient = (idx) => {
    setRecipients(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order_num: i + 1 })))
    setFields(prev => prev
      .filter(f => f.recipient_index !== idx)
      .map(f => ({ ...f, recipient_index: f.recipient_index > idx ? f.recipient_index - 1 : f.recipient_index }))
    )
    setSelectedIdx(i => Math.max(0, i === idx ? i - 1 : i > idx ? i - 1 : i))
    setSaved(false)
  }

  const deleteField = useCallback((fid) => {
    setFields(prev => prev.filter(f => f._id !== fid))
    setSaved(false)
  }, [])

  // Mouse handlers for drag-to-create fields
  const getPagePct = useCallback((e, pageNum) => {
    const el = pageRefs.current[pageNum]
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  const handleMouseDown = useCallback((e, pageNum) => {
    if (e.button !== 0 || recipients.length === 0) return
    e.preventDefault()
    const pt = getPagePct(e, pageNum)
    if (!pt) return
    setDragState({ pageNum, startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y })
  }, [recipients.length, getPagePct])

  const handleMouseMove = useCallback((e, pageNum) => {
    if (!dragState || dragState.pageNum !== pageNum) return
    const pt = getPagePct(e, pageNum)
    if (!pt) return
    setDragState(d => ({ ...d, curX: pt.x, curY: pt.y }))
  }, [dragState, getPagePct])

  const handleMouseUp = useCallback((e, pageNum) => {
    if (!dragState || dragState.pageNum !== pageNum) return
    const pt = getPagePct(e, pageNum)
    const x1 = Math.min(dragState.startX, pt?.x ?? dragState.curX)
    const y1 = Math.min(dragState.startY, pt?.y ?? dragState.curY)
    const w = Math.abs((pt?.x ?? dragState.curX) - dragState.startX)
    const h = Math.abs((pt?.y ?? dragState.curY) - dragState.startY)
    if (w >= MIN_FIELD_W && h >= MIN_FIELD_H) {
      setFields(prev => [...prev, {
        _id: nextId(),
        recipient_index: selectedIdx,
        page_number: pageNum,
        x_pct: x1, y_pct: y1, w_pct: w, h_pct: h,
      }])
      setSaved(false)
    }
    setDragState(null)
  }, [dragState, selectedIdx, getPagePct])

  // Cancel drag on mouse leave from page
  const handleMouseLeave = useCallback((pageNum) => {
    if (dragState?.pageNum === pageNum) setDragState(null)
  }, [dragState])

  const isDraft = doc?.status === 'draft'
  const isSent = doc?.status === 'sent'
  const isCompleted = doc?.status === 'completed'

  if (isLoading) return (
    <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
  )
  if (!doc) return <div className="card p-8 text-center text-secondary-500">Document not found</div>

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="card p-3 flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/signing')} className="p-1.5 text-secondary-400 hover:text-secondary-700 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-secondary-900">{doc.title}</h1>
            <p className="text-xs text-secondary-400">{doc.file_name}</p>
          </div>
          {doc.status === 'draft' && <span className="badge-draft">Draft</span>}
          {doc.status === 'sent' && <span className="badge-progress">Sent for Signing</span>}
          {doc.status === 'completed' && <span className="badge-completed">Completed</span>}
        </div>
        <div className="flex items-center gap-2">
          {isCompleted && doc.final_pdf_url_signed && (
            <a href={doc.final_pdf_url_signed} target="_blank" rel="noreferrer" className="btn-primary text-sm flex items-center gap-1.5">
              <Download size={13} /> Download Signed PDF
            </a>
          )}
          {isDraft && (
            <>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-secondary text-sm flex items-center gap-1.5">
                <Save size={13} /> Save
              </button>
              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || recipients.length === 0 || fields.length === 0}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                {sendMutation.isPending
                  ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Sending…</>
                  : <><Send size={13} /> Send for Signing</>}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-72 flex-shrink-0 space-y-3">
          {/* Recipients */}
          <div className="card p-4 space-y-3">
            <h3 className="font-semibold text-sm text-secondary-800 flex items-center gap-2"><Users size={14} /> Recipients</h3>

            {recipients.length === 0 && (
              <p className="text-xs text-secondary-400">Add at least one recipient to place signature fields.</p>
            )}

            {recipients.map((r, idx) => {
              const color = COLORS[idx % COLORS.length]
              const fieldCount = fields.filter(f => f.recipient_index === idx).length
              return (
                <div
                  key={idx}
                  onClick={() => { if (isDraft) setSelectedIdx(idx) }}
                  className={`relative flex items-start gap-2 p-2.5 rounded-lg border-2 transition-all ${isDraft ? 'cursor-pointer' : ''} ${selectedIdx === idx && isDraft ? `border-[${color.border}] bg-white shadow-sm` : 'border-transparent bg-secondary-50'}`}
                  style={selectedIdx === idx && isDraft ? { borderColor: color.border } : {}}
                >
                  <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5" style={{ background: color.border }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary-900 truncate">{r.name}</p>
                    <p className="text-xs text-secondary-400 truncate">{r.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: color.text }}>
                      {fieldCount} field{fieldCount !== 1 ? 's' : ''} · Signer {r.order_num}
                    </p>
                    {isSent && (
                      <p className="text-xs mt-0.5">
                        {doc.recipients?.find(dbr => dbr.email === r.email)?.status === 'completed'
                          ? <span className="text-green-600 font-medium">✓ Signed</span>
                          : <span className="text-amber-600">Awaiting…</span>}
                      </p>
                    )}
                  </div>
                  {isDraft && (
                    <button onClick={e => { e.stopPropagation(); removeRecipient(idx) }} className="p-0.5 text-secondary-300 hover:text-red-500">
                      <X size={13} />
                    </button>
                  )}
                </div>
              )
            })}

            {isDraft && recipients.length < COLORS.length && (
              <div className="space-y-2 pt-1 border-t border-secondary-100">
                <input
                  className="input text-sm py-1.5"
                  placeholder="Full name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addRecipient()}
                />
                <input
                  className="input text-sm py-1.5"
                  placeholder="Email address"
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addRecipient()}
                />
                <button onClick={addRecipient} className="btn-secondary w-full text-sm flex items-center justify-center gap-1.5 py-1.5">
                  <UserPlus size={13} /> Add Recipient
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          {isDraft && recipients.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1"><Info size={12} /> How to place fields</p>
              <p className="text-xs text-amber-700">
                <strong style={{ color: COLORS[selectedIdx % COLORS.length].text }}>{recipients[selectedIdx]?.name}</strong> is selected.
                Click and drag on the document to place their signature field.
              </p>
            </div>
          )}

          {/* Field summary */}
          {fields.length > 0 && (
            <div className="card p-3">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Placed Fields ({fields.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {fields.map(f => {
                  const r = recipients[f.recipient_index]
                  const c = COLORS[f.recipient_index % COLORS.length]
                  return (
                    <div key={f._id} className="flex items-center justify-between text-xs py-1 px-2 rounded" style={{ background: c.bg }}>
                      <span style={{ color: c.text }}>{r?.name || '?'} · p.{f.page_number}</span>
                      {isDraft && (
                        <button onClick={() => deleteField(f._id)} className="hover:text-red-500 ml-2" style={{ color: c.text }}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* PDF viewer */}
        <div className="flex-1 overflow-y-auto bg-secondary-200 rounded-xl p-4 space-y-4">
          {!doc.file_url_signed ? (
            <p className="text-center text-secondary-400 py-8">Loading document…</p>
          ) : (
            <Document
              file={doc.file_url_signed}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              onLoadError={err => console.error('PDF load error', err)}
              loading={<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" /></div>}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                <div key={pageNum} className="mb-4">
                  <p className="text-xs text-secondary-400 mb-1.5 text-center">Page {pageNum} of {numPages}</p>
                  <div
                    className="relative inline-block shadow-2xl select-none"
                    ref={el => { if (el) pageRefs.current[pageNum] = el }}
                    style={{ cursor: isDraft && recipients.length > 0 ? 'crosshair' : 'default' }}
                    onMouseDown={isDraft ? e => handleMouseDown(e, pageNum) : undefined}
                    onMouseMove={isDraft ? e => handleMouseMove(e, pageNum) : undefined}
                    onMouseUp={isDraft ? e => handleMouseUp(e, pageNum) : undefined}
                    onMouseLeave={isDraft ? () => handleMouseLeave(pageNum) : undefined}
                  >
                    <Page
                      pageNumber={pageNum}
                      width={PAGE_WIDTH}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />

                    {/* Placed fields */}
                    {fields.filter(f => f.page_number === pageNum).map(f => {
                      const c = COLORS[f.recipient_index % COLORS.length]
                      const r = recipients[f.recipient_index]
                      return (
                        <div
                          key={f._id}
                          style={{
                            position: 'absolute',
                            left: `${f.x_pct}%`,
                            top: `${f.y_pct}%`,
                            width: `${f.w_pct}%`,
                            height: `${f.h_pct}%`,
                            background: c.bg,
                            border: `2px solid ${c.border}`,
                            borderRadius: '3px',
                            pointerEvents: isDraft ? 'auto' : 'none',
                            cursor: isDraft ? 'default' : 'default',
                          }}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          <span style={{
                            fontSize: '9px',
                            color: c.text,
                            fontWeight: 600,
                            padding: '1px 3px',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            lineHeight: 1.2,
                          }}>
                            ✍ {r?.name || '?'}
                          </span>
                          {isDraft && (
                            <button
                              onClick={e => { e.stopPropagation(); deleteField(f._id) }}
                              style={{
                                position: 'absolute',
                                top: '-7px',
                                right: '-7px',
                                width: '16px',
                                height: '16px',
                                background: c.border,
                                border: 'none',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'white',
                                padding: 0,
                              }}
                            >
                              <X size={9} />
                            </button>
                          )}
                        </div>
                      )
                    })}

                    {/* Drag preview */}
                    {dragState?.pageNum === pageNum && (
                      (() => {
                        const x1 = Math.min(dragState.startX, dragState.curX)
                        const y1 = Math.min(dragState.startY, dragState.curY)
                        const w = Math.abs(dragState.curX - dragState.startX)
                        const h = Math.abs(dragState.curY - dragState.startY)
                        const c = COLORS[selectedIdx % COLORS.length]
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${x1}%`,
                              top: `${y1}%`,
                              width: `${w}%`,
                              height: `${h}%`,
                              background: c.bg,
                              border: `2px dashed ${c.border}`,
                              borderRadius: '3px',
                              pointerEvents: 'none',
                            }}
                          />
                        )
                      })()
                    )}
                  </div>
                </div>
              ))}
            </Document>
          )}
        </div>
      </div>
    </div>
  )
}
