import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const user = await login(email, password)
      if (user.role === 'admin') {
        navigate('/dashboard')
      } else if (user.role === 'manager') {
        navigate('/manager/dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Invalid email or password'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Hiring Assessment Platform</h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 ${
                  error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
                required
                placeholder="admin@yourcompany.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 pr-10 ${
                    error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                  }`}
                  required
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="break-words">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent-500 hover:bg-accent-600 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="text-center mt-2">
              <Link
                to="/forgot-password"
                className="text-sm text-accent-500 hover:text-accent-600 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}