import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Upload, Edit, Trash2, Eye, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getQuestions, deleteQuestion } from '../../api/questions'
import { formatDate } from '../../utils/helpers'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'

export default function QuestionsList() {
  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, questionId: null, questionText: '' })
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    type: '',
    difficulty: '',
    topic: '',
    is_active: true,
  })
  const navigate = useNavigate()

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'MCQ', label: 'MCQ' },
    { value: 'CODING', label: 'Coding' },
  ]

  const difficultyOptions = [
    { value: '', label: 'All Difficulties' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ]

  const resetFilters = () => {
    setFilters({
      type: '',
      difficulty: '',
      topic: '',
      is_active: true,
    })
    setSearchTerm('')
  }

  const fetchQuestions = async () => {
    setIsLoading(true)
    try {
      const params = { limit: 100 }
      if (filters.type) params.type = filters.type
      if (filters.difficulty) params.difficulty = filters.difficulty
      if (filters.topic) params.topic = filters.topic
      if (filters.is_active !== undefined) params.is_active = filters.is_active
      const data = await getQuestions(params)
      
      let filteredQuestions = data.items || []
      
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        filteredQuestions = filteredQuestions.filter(q => {
          const text = (q.text || '').toLowerCase()
          const topic = (q.topic || '').toLowerCase()
          const role = (q.role || '').toLowerCase()
          const tags = (q.tags || []).map(t => t.toLowerCase())
          const description = (q.description || '').toLowerCase()
          
          return text.includes(term) ||
                 topic.includes(term) ||
                 role.includes(term) ||
                 tags.some(tag => tag.includes(term)) ||
                 description.includes(term)
        })
      }
      
      setQuestions(filteredQuestions)
      setTotal(data.total || 0)
    } catch (error) {
      toast.error('Failed to load questions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchQuestions()
  }, [searchTerm, filters])

  const handleDelete = async (id, text) => {
    if (!window.confirm(`Are you sure you want to delete this question?`)) return
    try {
      await deleteQuestion(id)
      toast.success('Question deleted successfully')
      setDeleteModal({ isOpen: false, questionId: null, questionText: '' })
      fetchQuestions()
    } catch (error) {
      toast.error('Failed to delete question')
    }
  }

  const openDeleteModal = (id, text) => {
    setDeleteModal({ isOpen: true, questionId: id, questionText: text })
  }

  const getTypeBadge = (type) => {
    return <Badge variant={type === 'CODING' ? 'warning' : 'primary'}>{type}</Badge>
  }

  const getDifficultyBadge = (difficulty) => {
    const map = {
      easy: 'success',
      medium: 'warning',
      hard: 'danger',
    }
    return <Badge variant={map[difficulty] || 'default'}>{difficulty}</Badge>
  }

  const getStatusBadge = (isActive) => {
    return <Badge variant={isActive ? 'active' : 'inactive'}>{isActive ? 'Active' : 'Inactive'}</Badge>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Questions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/questions/bulk-import')}>
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={() => navigate('/questions/create')}>
            <Plus className="w-4 h-4 mr-2" />
            New Question
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by text, topic, tag, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>
          <Select
            options={typeOptions}
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="w-40"
          />
          <Select
            options={difficultyOptions}
            value={filters.difficulty}
            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
            className="w-40"
          />
          <Button variant="outline" onClick={fetchQuestions}>
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
            <TableHeader>Question</TableHeader>
            <TableHeader>Type</TableHeader>
            <TableHeader>Difficulty</TableHeader>
            <TableHeader>Topic</TableHeader>
            <TableHeader>Tags</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Created</TableHeader>
            <TableHeader className="text-right">Actions</TableHeader>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : questions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No questions found
                </TableCell>
              </TableRow>
            ) : (
              questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium text-navy-800 max-w-xs truncate">
                    {q.text}
                  </TableCell>
                  <TableCell>{getTypeBadge(q.type)}</TableCell>
                  <TableCell>{getDifficultyBadge(q.difficulty)}</TableCell>
                  <TableCell>{q.topic || '-'}</TableCell>
                  <TableCell>
                    {q.tags && q.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {q.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                        {q.tags.length > 2 && (
                          <span className="text-xs text-gray-400">+{q.tags.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(q.is_active)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(q.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/questions/${q.id}`)}
                        className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/questions/${q.id}/edit`)}
                        className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(q.id, q.text)}
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
          Total: {total} questions
        </div>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, questionId: null, questionText: '' })}
        title="Delete Question"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this question?
          </p>
          <p className="text-sm text-gray-500">
            <strong>{deleteModal.questionText}</strong>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                handleDelete(deleteModal.questionId, deleteModal.questionText)
              }}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteModal({ isOpen: false, questionId: null, questionText: '' })}
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