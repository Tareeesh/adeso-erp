import { useState, useEffect } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { X, QrCode } from 'lucide-react'

export default function QRScanner({ onScan, onClose }) {
  const [error, setError] = useState(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false)
    scanner.render(
      (decodedText) => {
        scanner.clear()
        onScan(decodedText)
      },
      (err) => {
        if (!err.includes('No QR code found')) setError(err)
      }
    )
    return () => scanner.clear().catch(() => {})
  }, [onScan])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-secondary-200">
          <h3 className="font-semibold flex items-center gap-2"><QrCode size={18} className="text-primary-600" />Scan QR Code</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary-100"><X size={16} /></button>
        </div>
        <div className="p-4">
          <div id="qr-reader" className="rounded-lg overflow-hidden" />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <p className="text-xs text-secondary-400 text-center mt-3">Point camera at a QR code to scan</p>
        </div>
      </div>
    </div>
  )
}
