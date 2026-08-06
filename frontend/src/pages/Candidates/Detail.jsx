import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Mail, Phone, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCandidate } from '../../api/candidates'
import { getThresholds } from '../../api/thresholds'
import { formatDate } from '../../utils/helpers'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

export default function CandidateDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [candidate, setCandidate] = useState(null)
  const [threshold, setThreshold] = useState(null)
  const [loading, setLoading] = useState(true)
  const [thresholds, setThresholds] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [candidateData, thresholdsData] = await Promise.all([
          getCandidate(parseInt(id)),
          getThresholds()
        ])
        setCandidate(candidateData)
        setThresholds(thresholdsData)
        if (candidateData.job_role_id) {
          const t = thresholdsData.find(th => th.id === candidateData.job_role_id)
          setThreshold(t)
        }
      } catch (error) {
        toast.error('Failed to load candidate details')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleCancel = () => {
    navigate('/app/candidates')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="text-center py-12 px-4">
        <h2 className="text-lg sm:text-xl font-bold text-navy-800">Candidate Not Found</h2>
        <Button className="mt-4" onClick={handleCancel}>Back to Candidates</Button>
      </div>
    )
  }

  const isEligible = candidate.ats_score !== null && threshold && candidate.ats_score >= threshold.ats_threshold

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="flex items-center gap-3 sm:gap-4 mb-6">
        <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800 flex-1 min-w-0">Candidate Details</h1>
        <Link to={'/app/candidates/' + candidate.id + '/edit'} className="flex-shrink-0">
          <Button size="sm">
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-navy-800 truncate">{candidate.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-600 text-sm sm:text-base truncate">{candidate.email}</span>
            </div>
            {candidate.phone && (
              <div className="flex items-center gap-2 mt-1">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 text-sm sm:text-base">{candidate.phone}</span>
              </div>
            )}
            {candidate.resume_url && (
              <div className="flex items-center gap-2 mt-1">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-accent-500 hover:underline text-sm">
                  View Resume
                </a>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Job Role</span>
              <p className="font-medium">{candidate.job_role || 'Not assigned'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">ATS Score</span>
              <p className="font-medium">
                {candidate.ats_score !== null ? (
                  <span className={isEligible ? 'text-green-600' : 'text-red-600'}>
                    {candidate.ats_score}%
                  </span>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Threshold</span>
              <p className="font-medium">{threshold ? threshold.ats_threshold + '%' : 'N/A'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Status</span>
              <div className="mt-1">
                {candidate.shortlisted ? (
                  <Badge variant="success">Shortlisted</Badge>
                ) : (
                  <Badge variant="inactive">Not Shortlisted</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
        <h3 className="font-semibold text-navy-800 mb-4 text-sm sm:text-base">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm font-medium">{formatDate(candidate.created_at)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500">Last Updated</p>
            <p className="text-sm font-medium">{formatDate(candidate.updated_at)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-xs text-gray-500">Sessions</p>
            <p className="text-sm font-medium">0</p>
          </div>
        </div>
      </div>
    </div>
  )
}