import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  UserCheck, Eye, Download, Filter, 
  Search, RefreshCw, Mail, Phone, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'

export default function EligibleShortlist() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, candidateId: null, candidateName: '', sessionId: null })
  const [deleting, setDeleting] = useState(false)
  const [filters, setFilters] = useState({
    job_role: '',
    search: ''
  })

  useEffect(() => {
    fetchEligibleCandidates()
  }, [filters])

  const fetchEligibleCandidates = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.job_role) params.job_role = filters.job_role
      if (filters.search) params.search = filters.search
      
      const response = await apiClient.get('/manager/candidates/eligible-shortlist', { params })
      setCandidates(response.data.items || [])
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error('Failed to fetch eligible candidates:', error)
      toast.error('Failed to load eligible candidates')
    } finally {
      setLoading(false)
    }
  }

  const exportList = async (format) => {
    try {
      const response = await apiClient.get('/manager/candidates/export', {
        params: { 
          format, 
          shortlisted: true,
          ...filters 
        },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `eligible_shortlist.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Export successful')
    } catch (error) {
      toast.error('Failed to export list')
    }
  }

  const handleDeleteCandidate = async () => {
    if (!deleteModal.candidateId) {
      toast.error('No candidate selected')
      return
    }
    
    setDeleting(true)
    try {
      const response = await apiClient.delete(`/candidates/${deleteModal.candidateId}`)
      
      if (response.data && response.data.deleted === true) {
        toast.success(`Candidate ${deleteModal.candidateName} deleted successfully`)
      } else if (response.data && response.data.deactivated === true) {
        toast.error(`Candidate ${deleteModal.candidateName} has sessions. Deactivated instead of deleted.`)
      } else {
        toast.success(`Candidate ${deleteModal.candidateName} processed successfully`)
      }
      
      setDeleteModal({ isOpen: false, candidateId: null, candidateName: '', sessionId: null })
      
      await fetchEligibleCandidates()
      
    } catch (error) {
      console.error('Delete error:', error)
      const message = error.response?.data?.detail || error.response?.data?.message || 'Failed to delete candidate'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteModal = (candidate) => {
    setDeleteModal({
      isOpen: true,
      candidateId: candidate.candidate_id,
      candidateName: candidate.candidate_name,
      sessionId: candidate.session_id
    })
  }

  const getEligibilityColor = (eligibility) => {
    const map = {
      auto_eligible: 'bg-green-100 text-green-700',
      manager_overridden: 'bg-purple-100 text-purple-700'
    }
    return map[eligibility] || 'bg-gray-100 text-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-navy-800">Eligible Shortlist</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportList('csv')}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportList('json')}>
            <Download className="w-4 h-4 mr-1" />
            JSON
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="w-full sm:flex-1 sm:min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>
          <Button variant="outline" onClick={fetchEligibleCandidates} className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
        <div className="mt-3 text-sm text-gray-500">
          {total} candidates eligible for next round
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Candidate</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Job Role</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Score</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Integrity</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Eligibility</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                    No eligible candidates found
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.session_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <div>
                        <p className="font-medium text-navy-800 text-sm">{candidate.candidate_name}</p>
                        <p className="text-xs text-gray-500">{candidate.candidate_email}</p>
                        {candidate.candidate_phone && (
                          <p className="text-xs text-gray-400">{candidate.candidate_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm whitespace-nowrap">{candidate.job_role}</td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm whitespace-nowrap">
                      <span className="font-semibold">{candidate.total_score}%</span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-sm whitespace-nowrap">
                      <span className="font-medium">{candidate.integrity_score}%</span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getEligibilityColor(candidate.eligibility)}`}>
                        {candidate.eligibility.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                      <Badge variant={candidate.cheating_risk === 'clean' ? 'success' : 'warning'}>
                        {candidate.cheating_risk}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/app/manager/report/${candidate.candidate_id}`)}
                          className="p-2 -m-1 text-blue-600 hover:text-blue-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="View Report"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/app/sessions/view/${candidate.access_token}`)}
                          className="p-2 -m-1 text-green-600 hover:text-green-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="View Session"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(candidate)}
                          className="p-2 -m-1 text-red-600 hover:text-red-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Delete Candidate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Total: {total} eligible candidates
        </div>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, candidateId: null, candidateName: '', sessionId: null })}
        title="Delete Candidate"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <p className="font-medium">Warning: This action cannot be undone!</p>
            <p className="text-xs mt-1">Deleting this candidate will also remove all their sessions, answers, and recordings.</p>
          </div>
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{deleteModal.candidateName}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            {candidates.find(c => c.candidate_id === deleteModal.candidateId)?.session_id ? 'This candidate has an active session and will be deactivated.' : 'This candidate has no sessions and will be permanently deleted.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleDeleteCandidate}
              isLoading={deleting}
              variant="danger"
              className="flex-1"
            >
              {deleting ? 'Deleting...' : 'Delete Candidate'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, candidateId: null, candidateName: '', sessionId: null })}
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