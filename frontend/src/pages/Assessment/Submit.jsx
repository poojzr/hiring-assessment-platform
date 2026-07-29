import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { submitAssessment, getAssessmentStatus } from '../../api/assessments'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

export default function AssessmentSubmit() {
  const { accessToken } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState([])
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [autoSubmit, setAutoSubmit] = useState(false)

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true)
      try {
        const data = await getAssessmentStatus(accessToken)
        setStatus(data)
        if (data.status === 'completed') {
          navigate(`/assessment/${accessToken}/thankyou`)
          return
        }
        const stateAnswers = location.state?.answers || []
        setAnswers(stateAnswers)
        setTotalQuestions(location.state?.totalQuestions || 0)
        setAutoSubmit(location.state?.autoSubmit || false)
      } catch (error) {
        const message = error.response?.data?.detail || 'Failed to load assessment status'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [accessToken, navigate, location])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const answerList = answers.map(ans => ({
        question_id: ans.question_id,
        answer_data: ans.answer_data
      }))
      await submitAssessment(accessToken, answerList)
      toast.success('Assessment submitted successfully')
      navigate(`/assessment/${accessToken}/thankyou`)
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit assessment'
      toast.error(message)
      setError(message)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy-800 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    )
  }

  if (status?.status === 'completed') {
    return null
  }

  const answeredCount = answers.filter(a => a.answer_data && Object.keys(a.answer_data).length > 0).length

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-bold text-navy-800 mb-2">Ready to Submit?</h1>
            <p className="text-gray-500">Please review your answers before submitting</p>
          </div>

          <div className="border-t border-b border-gray-200 py-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500">Total Questions</p>
                <p className="text-xl font-bold text-navy-800">{totalQuestions}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Answered</p>
                <p className={`text-xl font-bold ${answeredCount === totalQuestions ? 'text-green-600' : 'text-yellow-600'}`}>
                  {answeredCount} / {totalQuestions}
                </p>
              </div>
            </div>
          </div>

          {answeredCount < totalQuestions && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-700">
                You have {totalQuestions - answeredCount} unanswered question(s). You can still submit, but unanswered questions will be marked as wrong.
              </p>
            </div>
          )}

          {answeredCount === totalQuestions && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-700">
                All questions answered. You are ready to submit!
              </p>
            </div>
          )}

          {autoSubmit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-700">
                Time is up! Your assessment is being submitted automatically.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              isLoading={submitting}
              variant="primary"
              className="flex-1"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/assessment/${accessToken}/take`)}
              className="flex-1"
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}