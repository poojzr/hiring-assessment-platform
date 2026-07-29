import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCandidates, checkATSScore } from '../../api/candidates'
import { getThresholds } from '../../api/thresholds'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'

export default function BulkSessionCreate() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [thresholds, setThresholds] = useState([])
  const [selectedCandidates, setSelectedCandidates] = useState([])
  const [results, setResults] = useState(null)
  const [jobRoleFilter, setJobRoleFilter] = useState('')
  const [shortlistedOnly, setShortlistedOnly] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [candidatesData, thresholdsData] = await Promise.all([
          getCandidates({ limit: 500 }),
          getThresholds()
        ])
        setCandidates(candidatesData.items || [])
        setThresholds(thresholdsData || [])
      } catch (error) {
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSelectAll = () => {
    const eligible = getFilteredCandidates()
    const allIds = eligible.map(c => c.id)
    setSelectedCandidates(allIds)
  }

  const handleDeselectAll = () => {
    setSelectedCandidates([])
  }

  const getFilteredCandidates = () => {
    let filtered = candidates
    if (jobRoleFilter) {
      filtered = filtered.filter(c => c.job_role_id === parseInt(jobRoleFilter))
    }
    if (shortlistedOnly) {
      filtered = filtered.filter(c => c.shortlisted === true)
    }
    return filtered
  }

  const handleToggleCandidate = (id) => {
    setSelectedCandidates(prev =>
      prev.includes(id)
        ? prev.filter(cid => cid !== id)
        : [...prev, id]
    )
  }

  const handleBulkCreate = async () => {
    if (selectedCandidates.length === 0) {
      toast.error('Please select at least one candidate')
      return
    }

    setSubmitting(true)
    setResults(null)

    const resultsList = []
    let successCount = 0
    let failCount = 0

    for (const candidateId of selectedCandidates) {
      try {
        const candidate = candidates.find(c => c.id === candidateId)
        const atsScore = candidate?.ats_score || 70
        const response = await checkATSScore(candidateId, atsScore)
        resultsList.push({
          candidateId,
          name: candidate?.name || 'Unknown',
          status: 'success',
          message: response.message || 'Session created',
          sessionId: response.session_id,
          accessToken: response.access_token,
        })
        successCount++
      } catch (error) {
        const candidate = candidates.find(c => c.id === candidateId)
        resultsList.push({
          candidateId,
          name: candidate?.name || 'Unknown',
          status: 'failed',
          message: error.response?.data?.detail || 'Failed to create session',
        })
        failCount++
      }
    }

    setResults({
      total: selectedCandidates.length,
      success: successCount,
      failed: failCount,
      items: resultsList,
    })

    toast.success(`${successCount} sessions created, ${failCount} failed`)
    setSubmitting(false)
  }

  const filteredCandidates = getFilteredCandidates()
  const jobRoleOptions = [
    { value: '', label: 'All Job Roles' },
    ...thresholds.map((t) => ({ value: String(t.id), label: t.job_role_name }))
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-navy-800">Bulk Session Creation</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Role</label>
            <Select
              options={jobRoleOptions}
              value={jobRoleFilter}
              onChange={(e) => setJobRoleFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filters</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={shortlistedOnly}
                  onChange={(e) => setShortlistedOnly(e.target.checked)}
                  className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
                />
                Shortlisted Only
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          {filteredCandidates.length} candidates found | {selectedCandidates.length} selected
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 w-12">
                  <input
                    type="checkbox"
                    checked={selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSelectAll()
                      } else {
                        handleDeselectAll()
                      }
                    }}
                    className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Job Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ATS Score</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Shortlisted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No candidates found
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(candidate.id)}
                        onChange={() => handleToggleCandidate(candidate.id)}
                        className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-navy-800">{candidate.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{candidate.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{candidate.job_role || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">
                      {candidate.ats_score !== null ? (
                        <span className={`font-medium ${candidate.ats_score >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                          {candidate.ats_score}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {candidate.shortlisted ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Yes</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleBulkCreate}
          isLoading={submitting}
          disabled={selectedCandidates.length === 0}
          className="flex-1"
        >
          <Users className="w-4 h-4 mr-2" />
          Create Sessions for {selectedCandidates.length} Candidate{selectedCandidates.length !== 1 ? 's' : ''}
        </Button>
        <Button variant="outline" onClick={() => navigate('/sessions')}>
          View All Sessions
        </Button>
      </div>

      {results && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-navy-800 mb-4">Import Results</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded text-center">
              <p className="text-2xl font-bold text-navy-800">{results.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-green-50 p-3 rounded text-center">
              <p className="text-2xl font-bold text-green-600">{results.success}</p>
              <p className="text-xs text-gray-500">Success</p>
            </div>
            <div className="bg-red-50 p-3 rounded text-center">
              <p className="text-2xl font-bold text-red-600">{results.failed}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {results.items.map((item, index) => (
              <div key={index} className={`text-sm p-2 ${item.status === 'success' ? 'text-green-600' : 'text-red-600'} border-b border-gray-100`}>
                {item.status === 'success' ? '✓' : '✗'} {item.name}: {item.message}
                {item.accessToken && (
                  <span className="ml-2 text-xs text-gray-400">Token: {item.accessToken.slice(0, 8)}...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}