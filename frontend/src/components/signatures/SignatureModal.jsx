import { useState, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '../../context/AuthContext'
import { X, RotateCcw } from 'lucide-react'

export default function SignatureModal({ onSign, onClose, loading }) {
  const { user } = useAuth()
  const [mode, setMode] = useState(user?.signature_url ? 'saved' : 'typed')
  const [typedName, setTypedName] = useState(`${user?.first_name} ${user?.last_name}`)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [comments, setComments] = useState('')
  const sigCanvas = useRef(null)

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: files => {
      const reader = new FileReader()
      reader.onload = e => setUploadedFile(e.target.result)
      reader.readAsDataURL(files[0])
    }
  })

  const handleSign = () => {
    let signatureData, signatureType

    if (mode === 'typed') {
      if (!typedName.trim()) return
      signatureData = typedName
      signatureType = 'typed'
    } else if (mode === 'drawn') {
      if (sigCanvas.current?.isEmpty()) return
      signatureData = sigCanvas.current.toDataURL('image/png')
      signatureType = 'drawn'
    } else if (mode === 'uploaded') {
      if (!uploadedFile) return
      signatureData = uploadedFile
      signatureType = 'uploaded'
    } else if (mode === 'saved') {
      signatureData = user.signature_url
      signatureType = user.signature_type
    }

    onSign({ signatureData, signatureType, typedName: mode === 'typed' ? typedName : undefined, comments })
  }

  const tabs = [
    { key: 'typed', label: 'Type' },
    { key: 'drawn', label: 'Draw' },
    { key: 'uploaded', label: 'Upload' },
    ...(user?.signature_url ? [{ key: 'saved', label: 'Saved' }] : []),
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-secondary-200">
          <h3 className="font-semibold text-secondary-900">Add Your Signature</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary-100"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === tab.key ? 'bg-white text-primary-600 shadow-sm' : 'text-secondary-600 hover:text-secondary-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'typed' && (
            <div>
              <label className="label">Type your full name</label>
              <input
                className="input text-xl font-cursive italic text-primary-700"
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                style={{ fontFamily: 'Georgia, serif' }}
              />
              {typedName && (
                <div className="mt-3 p-4 border-2 border-dashed border-secondary-200 rounded-lg text-center">
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: '#1d4ed8' }}>{typedName}</p>
                </div>
              )}
            </div>
          )}

          {mode === 'drawn' && (
            <div>
              <label className="label">Draw your signature</label>
              <div className="border-2 border-secondary-200 rounded-lg overflow-hidden">
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{ width: 400, height: 150, className: 'w-full' }}
                  backgroundColor="white"
                />
              </div>
              <button onClick={() => sigCanvas.current?.clear()} className="mt-2 flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-700">
                <RotateCcw size={13} />Clear
              </button>
            </div>
          )}

          {mode === 'uploaded' && (
            <div>
              <label className="label">Upload signature image</label>
              <div {...getRootProps()} className="border-2 border-dashed border-secondary-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50">
                <input {...getInputProps()} />
                {uploadedFile ? (
                  <img src={uploadedFile} alt="Signature" className="max-h-24 mx-auto" />
                ) : (
                  <p className="text-secondary-500 text-sm">Drop signature image here, or click to browse</p>
                )}
              </div>
            </div>
          )}

          {mode === 'saved' && user?.signature_url && (
            <div>
              <label className="label">Your saved signature</label>
              <div className="border-2 border-secondary-200 rounded-lg p-4 text-center">
                {user.signature_type === 'typed' ? (
                  <p style={{ fontFamily: 'Georgia, serif', fontSize: '24px', color: '#1d4ed8' }}>{user.signature_url}</p>
                ) : (
                  <img src={user.signature_url} alt="Saved signature" className="max-h-20 mx-auto" />
                )}
              </div>
            </div>
          )}

          <div>
            <label className="label">Comments (optional)</label>
            <textarea className="input resize-none" rows={2} value={comments} onChange={e => setComments(e.target.value)} placeholder="Add any comments..." />
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSign} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Signing...' : 'Sign Document'}
          </button>
        </div>
      </div>
    </div>
  )
}
