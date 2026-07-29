import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit, Calendar, Tag, FileText, Code } from 'lucide-react'
import toast from 'react-hot-toast'
import { getQuestion, getQuestionHistory } from '../../api/questions'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../../components/ui/Table'

export default function QuestionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [question, setQuestion] = useState(null)
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [qData, hData] = await Promise.all([
          getQuestion(id),
          getQuestionHistory(id)
        ])
        setQuestion(qData)
        setHistory(hData || [])
      } catch (error) {
        toast.error('Failed to load question')
        navigate('/questions')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!question) return null

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
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/questions')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Questions
        </button>
        <button
          onClick={() => navigate(`/questions/${id}/edit`)}
          className="flex items-center gap-2 text-accent-500 hover:text-accent-600"
        >
          <Edit className="w-4 h-4" />
          Edit Question
        </button>
      </div>

      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-800">{question.text}</h1>
            <div className="flex items-center gap-3 mt-2">
              {getTypeBadge(question.type)}
              {getDifficultyBadge(question.difficulty)}
              {getStatusBadge(question.is_active)}
              {question.topic && <Badge variant="default">{question.topic}</Badge>}
            </div>
          </div>
        </div>

        {question.description && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <p className="text-gray-700">{question.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          {question.role && (
            <div>
              <p className="text-xs text-gray-500">Role</p>
              <p className="text-sm text-navy-800">{question.role}</p>
            </div>
          )}
          {question.language && (
            <div>
              <p className="text-xs text-gray-500">Language</p>
              <p className="text-sm text-navy-800 capitalize">{question.language}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm text-navy-800">
              {question.created_at ? new Date(question.created_at).toLocaleString() : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Updated</p>
            <p className="text-sm text-navy-800">
              {question.updated_at ? new Date(question.updated_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {question.tags && question.tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {question.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {question.type === 'MCQ' && question.options && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Options</p>
            <div className="space-y-1">
              {Object.entries(question.options).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                  <span className="font-medium text-gray-500">{key}.</span>
                  <span>{value}</span>
                  {question.correct_answer === key && (
                    <Badge variant="success" className="ml-2">Correct</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {question.type === 'CODING' && question.public_test_cases && question.public_test_cases.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Public Test Cases</p>
            <div className="space-y-1">
              {question.public_test_cases.map((tc, index) => (
                <div key={index} className="flex gap-4 p-2 bg-gray-50 rounded-md text-sm">
                  <span><span className="text-gray-500">Input:</span> {tc.input}</span>
                  <span><span className="text-gray-500">Expected:</span> {tc.expected}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-navy-800 mb-4">Version History</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHead>
                <TableHeader>Version</TableHeader>
                <TableHeader>Changed At</TableHeader>
                <TableHeader>Changed By</TableHeader>
              </TableHead>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.version}>
                    <TableCell className="font-medium">v{h.version}</TableCell>
                    <TableCell>{h.changed_at ? new Date(h.changed_at).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>{h.changed_by ? `User ${h.changed_by}` : 'System'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}