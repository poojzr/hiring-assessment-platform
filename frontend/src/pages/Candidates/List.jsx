import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Edit, Trash2, Eye, Search, RefreshCw, Copy, Mail, CheckCircle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCandidates, deleteCandidate, checkATSScore, resendAssessmentEmail } from '../../api/candidates'
import { getThresholds } from '../../api/thresholds'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'

export default function CandidatesList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [thresholds, setThresholds] = useState([])
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, candidateId: null, candidateName: '' })
  const [atsModal, setAtsModal] = useState({ isOpen: false, candidateId: null, candidateName: '', atsScore: 70 })
  const [isChecking, setIsChecking] = useState(false)
  const navigate = useNavigate()

  const search = searchParams.get('search') || ''
  const shortlistedFilter = searchParams.get('shortlisted') || ''
  const jobRoleFilter = searchParams.get('jobRole') || ''

  useEffect(() => {
    fetchThresholds()
  }, [])

  useEffect(() => {
    fetchCandidates()
  }, [search, shortlistedFilter, jobRoleFilter])

  const fetchThresholds = async () => {
    try {
      const data = await getThresholds()
      setThresholds(data || [])
    } catch (error) {
      setThresholds([])
    }
  }

  const fetchCandidates = async () => {
    setIsLoading(true)
    try {
      const params = {
        search: search || undefined,
        shortlisted: shortlistedFilter === 'true' ? true : shortlistedFilter === 'false' ? false : undefined,
        job_role_id: jobRoleFilter ? parseInt(jobRoleFilter) : undefined,
        limit: 100
      }
      const data = await getCandidates(params)
      setCandidates(data.items || [])
      setTotal(data.total || 0)
    } catch (error) {
      toast.error('Failed to load candidates')
    } finally {
      setIsLoading(false)
    }
  }

  const updateFilter = (key, value) => {
    if (value) {
      searchParams.set(key, value)
    } else {
      searchParams.delete(key)
    }
    setSearchParams(searchParams)
  }

  const resetFilters = () => {
    searchParams.delete('search')
    searchParams.delete('shortlisted')
    searchParams.delete('jobRole')
    setSearchParams(searchParams)
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm('Are you sure you want to delete candidate "' + name + '"? This will also delete all associated sessions and data.')) return
    try {
      await deleteCandidate(id)
      toast.success('Candidate deleted successfully')
      setDeleteModal({ isOpen: false, candidateId: null, candidateName: '' })
      fetchCandidates()
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to delete candidate'
      toast.error(message)
    }
  }

  const openDeleteModal = (id, name) => {
    setDeleteModal({ isOpen: true, candidateId: id, candidateName: name })
  }

  const handleATSCheck = async () => {
    const { candidateId, atsScore } = atsModal
    setIsChecking(true)
    try {
      const result = await checkATSScore(candidateId, atsScore)
      if (result.shortlisted) {
        toast.success('Candidate shortlisted. Score: ' + atsScore + '%')
        if (result.session_created) {
          toast.success('Assessment session created successfully')
        }
        if (result.email_sent) {
          toast.success('Assessment email sent to candidate')
        } else {
          toast.warning('Session created but email failed to send')
        }
        if (result.access_token) {
          toast.success('Access Token: ' + result.access_token.slice(0, 12) + '...')
        }
      } else {
        toast.warning('Not shortlisted. Score: ' + atsScore + '% below threshold')
      }
      setAtsModal({ isOpen: false, candidateId: null, candidateName: '', atsScore: 70 })
      fetchCandidates()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to check ATS score')
    } finally {
      setIsChecking(false)
    }
  }

  const openAtsModal = (id, name, currentScore) => {
    setAtsModal({
      isOpen: true,
      candidateId: id,
      candidateName: name,
      atsScore: currentScore || 70
    })
  }

  const handleResendEmail = async (id) => {
    try {
      await resendAssessmentEmail(id)
      toast.success('Assessment email resent successfully')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend email')
    }
  }

  const handleCopyToken = (token) => {
    if (!token) {
      toast.error('No access token available')
      return
    }
    const link = window.location.origin + '/assessment/' + token
    navigator.clipboard.writeText(link)
    toast.success('Assessment link copied to clipboard')
  }

  const getThresholdForCandidate = (candidate) => {
    if (candidate.job_role_id) {
      const threshold = thresholds.find(t => t.id === candidate.job_role_id)
      return threshold?.ats_threshold || 70
    }
    return 70
  }

  const shortlistedOptions = [
    { value: '', label: 'All Candidates' },
    { value: 'true', label: 'Shortlisted' },
    { value: 'false', label: 'Not Shortlisted' }
  ]

  const jobRoleOptions = [
    { value: '', label: 'All Job Roles' },
    ...thresholds.map((t) => ({ value: String(t.id), label: t.job_role_name }))
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Candidates</h1>
        <Button onClick={() => navigate('/candidates/create')} className="w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Candidate
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>
          <Select
            options={shortlistedOptions}
            value={shortlistedFilter}
            onChange={(e) => updateFilter('shortlisted', e.target.value)}
            className="w-full sm:w-44"
          />
          <Select
            options={jobRoleOptions}
            value={jobRoleFilter}
            onChange={(e) => updateFilter('jobRole', e.target.value)}
            className="w-full sm:w-48"
          />
          <Button variant="outline" onClick={fetchCandidates} className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHead>
            <TableHeader>Name</TableHeader>
            <TableHeader>Email</TableHeader>
            <TableHeader>Job Role</TableHeader>
            <TableHeader>ATS Score</TableHeader>
            <TableHeader>Threshold</TableHeader>
            <TableHeader>Shortlisted</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No candidates found
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((candidate) => {
                const threshold = getThresholdForCandidate(candidate)
                const isEligible = candidate.ats_score !== null && candidate.ats_score >= threshold
                return (
                  <TableRow key={candidate.id}>
                    <TableCell className="font-medium text-navy-800 whitespace-nowrap">{candidate.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{candidate.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{candidate.job_role || 'N/A'}</TableCell>
                    <TableCell>
                      {candidate.ats_score !== null ? (
                        <span className={'font-medium ' + (isEligible ? 'text-green-600' : 'text-red-600')}>
                          {candidate.ats_score}%
                        </span>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>{threshold}%</TableCell>
                    <TableCell>
                      {candidate.shortlisted ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="inactive">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate('/candidates/' + candidate.id)}
                          className="p-2 -m-1 text-gray-600 hover:text-gray-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate('/candidates/' + candidate.id + '/edit')}
                          className="p-2 -m-1 text-blue-600 hover:text-blue-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openAtsModal(candidate.id, candidate.name, candidate.ats_score)}
                          className="p-2 -m-1 text-purple-600 hover:text-purple-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Check ATS Score"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {candidate.shortlisted && candidate.access_token && (
                          <>
                            <button
                              onClick={() => handleCopyToken(candidate.access_token)}
                              className="p-2 -m-1 text-green-600 hover:text-green-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="Copy Assessment Link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleResendEmail(candidate.id)}
                              className="p-2 -m-1 text-blue-500 hover:text-blue-700 min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="Resend Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate('/sessions/view/' + candidate.access_token)}
                              className="p-2 -m-1 text-indigo-600 hover:text-indigo-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="View Session"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => openDeleteModal(candidate.id, candidate.name)}
                          className="p-2 -m-1 text-red-600 hover:text-red-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Total: {total} candidates
        </div>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, candidateId: null, candidateName: '' })}
        title="Delete Candidate"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{deleteModal.candidateName}</strong>?
          </p>
          <p className="text-sm text-red-600">This will also delete all associated sessions and data.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="danger"
              onClick={() => handleDelete(deleteModal.candidateId, deleteModal.candidateName)}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, candidateId: null, candidateName: '' })}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={atsModal.isOpen}
        onClose={() => setAtsModal({ isOpen: false, candidateId: null, candidateName: '', atsScore: 70 })}
        title="Check ATS Score"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium">How this works:</p>
            <ul className="mt-1 space-y-1 text-xs">
              <li>Enter the ATS score (0-100)</li>
              <li>System checks against threshold</li>
              <li>If score is greater than or equal to threshold: Session created, Email sent</li>
              <li>If score is less than threshold: Not shortlisted</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Candidate</label>
            <p className="text-navy-800 font-medium">{atsModal.candidateName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ATS Score (0-100) *</label>
            <Input
              type="number"
              value={atsModal.atsScore}
              onChange={(e) => setAtsModal({ ...atsModal, atsScore: parseInt(e.target.value) || 0 })}
              min={0}
              max={100}
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleATSCheck}
              isLoading={isChecking}
              className="flex-1"
            >
              Check Score
            </Button>
            <Button
              variant="outline"
              onClick={() => setAtsModal({ isOpen: false, candidateId: null, candidateName: '', atsScore: 70 })}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}