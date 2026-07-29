import { useParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function AssessmentThankYou() {
  const { accessToken } = useParams()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-navy-800 mb-2">Thank You!</h1>
        <p className="text-gray-600 mb-4">
          Your assessment has been submitted successfully.
        </p>
        <p className="text-sm text-gray-500">
          You will receive an email notification with the results.
        </p>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400">
            Assessment ID: {accessToken?.slice(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  )
}