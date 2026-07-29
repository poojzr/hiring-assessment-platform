import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Edit, Trash2, Search, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getThresholds, deleteThreshold } from '../../api/thresholds'
import { formatDate } from '../../utils/helpers'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'

export default function ThresholdsList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [thresholds, setThresholds] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, thresholdId: null, thresholdName: '' })

  const search = searchParams.get('search') || ''
  const navigate = useNavigate()

  useEffect(() => {
    fetchThresholds()
  }, [search])

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
    setSearchParams(searchParams)
  }

  const fetchThresholds = async () => {
    setIsLoading(true)
    try {
      const data = await getThresholds()
      let filteredData = data || []
      if (search && search.trim()) {
        const term = search.toLowerCase().trim()
        filteredData = filteredData.filter(t => 
          t.job_role_name.toLowerCase().includes(term)
        )
      }
      setThresholds(filteredData)
    } catch (error) {
      toast.error('Failed to load thresholds')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id, name) => {
    try {
      await deleteThreshold(id)
      toast.success('Threshold deleted successfully')
      setDeleteModal({ isOpen: false, thresholdId: null, thresholdName: '' })
      fetchThresholds()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete threshold')
    }
  }

  const openDeleteModal = (id, name) => {
    setDeleteModal({ isOpen: true, thresholdId: id, thresholdName: name })
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-800">ATS Thresholds</h1>
        <Button onClick={() => navigate('/thresholds/create')}>
          <Plus className="w-4 h-4 mr-2" />
          New Threshold
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by job role..."
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>
          <Button variant="outline" onClick={fetchThresholds}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHead>
            <TableHeader>ID</TableHeader>
            <TableHeader>Job Role</TableHeader>
            <TableHeader>ATS Threshold</TableHeader>
            <TableHeader>Created</TableHeader>
            <TableHeader className="text-right">Actions</TableHeader>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : thresholds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No thresholds found
                </TableCell>
              </TableRow>
            ) : (
              thresholds.map((threshold) => (
                <TableRow key={threshold.id}>
                  <TableCell className="font-mono text-sm text-gray-500">{threshold.id}</TableCell>
                  <TableCell className="font-medium text-navy-800">{threshold.job_role_name}</TableCell>
                  <TableCell>
                    <Badge variant="primary">{threshold.ats_threshold}%</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(threshold.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/thresholds/${threshold.id}/edit`)}
                        className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(threshold.id, threshold.job_role_name)}
                        className="p-1 text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          Total: {thresholds.length} thresholds
        </div>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, thresholdId: null, thresholdName: '' })}
        title="Delete Threshold"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete threshold for <strong>{deleteModal.thresholdName}</strong>?
          </p>
          <p className="text-sm text-gray-500">This action cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleDelete(deleteModal.thresholdId, deleteModal.thresholdName)}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteModal({ isOpen: false, thresholdId: null, thresholdName: '' })}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}