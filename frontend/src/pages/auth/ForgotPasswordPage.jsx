import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { toast } from 'react-toastify'
import { Building2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-xl mb-3">
            <Building2 size={24} className="text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-secondary-900">Reset Password</h2>
        </div>
        {sent ? (
          <div className="text-center">
            <p className="text-green-600 font-medium">Check your email!</p>
            <p className="text-secondary-500 text-sm mt-2">If that email exists, a reset link has been sent.</p>
            <Link to="/login" className="btn-primary mt-4 inline-block">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link to="/login" className="block text-center text-sm text-primary-600">Back to Login</Link>
          </form>
        )}
      </div>
    </div>
  )
}
