import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { getQuestion, createQuestion, updateQuestion } from '../../api/questions'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'

export default function QuestionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(isEdit)
  const [formData, setFormData] = useState({
    type: 'MCQ',
    text: '',
    description: '',
    options: { A: '', B: '', C: '', D: '' },
    correct_answer: '',
    topic: '',
    difficulty: 'medium',
    role: '',
    language: 'python',
    supported_languages: [],
    allow_language_choice: false,
    public_test_cases: [],
    hidden_test_cases: [],
    coding_reference: '',
    tags: [],
  })

  const [newTag, setNewTag] = useState('')
  const [publicInput, setPublicInput] = useState({ input: '', expected: '' })
  const [hiddenInput, setHiddenInput] = useState({ input: '', expected: '' })

  const typeOptions = [
    { value: 'MCQ', label: 'MCQ' },
    { value: 'CODING', label: 'Coding' },
  ]

  const difficultyOptions = [
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ]

  const languageOptions = [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
  ]

  const allLanguages = ['python', 'javascript', 'java', 'c', 'cpp', 'csharp']

  useEffect(() => {
    if (isEdit) {
      const fetchQuestion = async () => {
        try {
          const data = await getQuestion(id)
          setFormData({
            type: data.type || 'MCQ',
            text: data.text || '',
            description: data.description || '',
            options: data.options || { A: '', B: '', C: '', D: '' },
            correct_answer: data.correct_answer || '',
            topic: data.topic || '',
            difficulty: data.difficulty || 'medium',
            role: data.role || '',
            language: data.language || 'python',
            supported_languages: data.supported_languages || [],
            allow_language_choice: data.allow_language_choice || false,
            public_test_cases: data.public_test_cases || [],
            hidden_test_cases: data.hidden_test_cases || [],
            coding_reference: data.coding_reference || '',
            tags: data.tags || [],
          })
        } catch (error) {
          toast.error('Failed to load question')
          navigate('/questions')
        } finally {
          setIsFetching(false)
        }
      }
      fetchQuestion()
    }
  }, [id, isEdit, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    const submitData = { ...formData }

    if (formData.type === 'MCQ') {
      const validOptions = Object.fromEntries(
        Object.entries(formData.options).filter(([key, value]) => value.trim() !== '')
      )
      submitData.options = validOptions
    } else {
      submitData.options = null
      submitData.correct_answer = null
      
      if (formData.allow_language_choice && formData.supported_languages.length === 0) {
        toast.error('Please select at least one supported language')
        setIsLoading(false)
        return
      }
    }

    try {
      if (isEdit) {
        await updateQuestion(id, submitData)
        toast.success('Question updated successfully')
      } else {
        await createQuestion(submitData)
        toast.success('Question created successfully')
      }
      navigate('/questions')
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.')
        setTimeout(() => {
          navigate('/login')
        }, 1500)
        return
      }
      const message = error.response?.data?.detail || 'Failed to save question'
      if (typeof message === 'string') {
        toast.error(message)
      } else if (Array.isArray(message)) {
        toast.error(message[0]?.msg || 'Validation error')
      } else {
        toast.error('Failed to save question')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const toggleLanguage = (lang) => {
    setFormData(prev => {
      const current = prev.supported_languages || []
      const newLangs = current.includes(lang)
        ? current.filter(l => l !== lang)
        : [...current, lang]
      return { ...prev, supported_languages: newLangs }
    })
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const removeTag = (tag) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })
  }

  const addPublicTestCase = () => {
    if (publicInput.input.trim() || publicInput.expected.trim()) {
      setFormData({
        ...formData,
        public_test_cases: [...formData.public_test_cases, { input: publicInput.input, expected: publicInput.expected }]
      })
      setPublicInput({ input: '', expected: '' })
    }
  }

  const removePublicTestCase = (index) => {
    setFormData({
      ...formData,
      public_test_cases: formData.public_test_cases.filter((_, i) => i !== index)
    })
  }

  const addHiddenTestCase = () => {
    if (hiddenInput.input.trim() || hiddenInput.expected.trim()) {
      setFormData({
        ...formData,
        hidden_test_cases: [...formData.hidden_test_cases, { input: hiddenInput.input, expected: hiddenInput.expected }]
      })
      setHiddenInput({ input: '', expected: '' })
    }
  }

  const removeHiddenTestCase = (index) => {
    setFormData({
      ...formData,
      hidden_test_cases: formData.hidden_test_cases.filter((_, i) => i !== index)
    })
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/questions')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Questions
      </button>

      <h1 className="text-2xl font-bold text-navy-800 mb-6">
        {isEdit ? 'Edit Question' : 'Create New Question'}
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Type"
            options={typeOptions}
            value={formData.type}
            onChange={(e) => {
              const newType = e.target.value
              setFormData({
                ...formData,
                type: newType,
                correct_answer: newType === 'CODING' ? '' : formData.correct_answer,
                options: newType === 'CODING' ? {} : formData.options,
                supported_languages: newType === 'CODING' ? formData.supported_languages : [],
                allow_language_choice: newType === 'CODING' ? formData.allow_language_choice : false,
              })
            }}
            required
          />

          <Input
            label="Question Text"
            value={formData.text}
            onChange={(e) => setFormData({ ...formData, text: e.target.value })}
            required
          />

          <Input
            label="Description (Optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          {formData.type === 'MCQ' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-navy-700">Options</label>
              {Object.entries(formData.options).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-6 font-medium text-gray-500">{key}.</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setFormData({
                      ...formData,
                      options: { ...formData.options, [key]: e.target.value }
                    })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                    placeholder={`Option ${key}`}
                  />
                </div>
              ))}
              <Select
                label="Correct Answer"
                options={Object.keys(formData.options).map(key => ({ value: key, label: key }))}
                value={formData.correct_answer}
                onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                required
              />
            </div>
          )}

          {formData.type === 'CODING' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-2">Supported Languages</label>
                <div className="flex flex-wrap gap-3">
                  {allLanguages.map((lang) => (
                    <label key={lang} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData.supported_languages || []).includes(lang)}
                        onChange={() => toggleLanguage(lang)}
                        className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
                      />
                      <span className="text-sm capitalize">{lang}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">Select all languages candidates can use for this question</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.allow_language_choice}
                  onChange={(e) => setFormData({ ...formData, allow_language_choice: e.target.checked })}
                  className="w-4 h-4 text-accent-500 rounded focus:ring-accent-500"
                />
                <label className="text-sm text-gray-700">Allow candidates to choose their preferred language</label>
              </div>

              <div className="mt-2">
                <label className="block text-sm font-medium text-navy-700 mb-1">Default Language</label>
                <Select
                  options={languageOptions}
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Default language if candidate doesn't choose</p>
              </div>

              <Input
                label="Coding Reference (Optional)"
                value={formData.coding_reference}
                onChange={(e) => setFormData({ ...formData, coding_reference: e.target.value })}
              />

              <div>
                <label className="block text-sm font-medium text-navy-700 mb-2">Public Test Cases</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Input"
                    value={publicInput.input}
                    onChange={(e) => setPublicInput({ ...publicInput, input: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <input
                    type="text"
                    placeholder="Expected Output"
                    value={publicInput.expected}
                    onChange={(e) => setPublicInput({ ...publicInput, expected: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <button
                    type="button"
                    onClick={addPublicTestCase}
                    className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {formData.public_test_cases.map((tc, index) => (
                  <div key={index} className="flex items-center justify-between mt-2 p-2 bg-gray-50 rounded-md">
                    <span className="text-sm">Input: {tc.input} → Expected: {tc.expected}</span>
                    <button
                      type="button"
                      onClick={() => removePublicTestCase(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-navy-700 mb-2">Hidden Test Cases</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Input"
                    value={hiddenInput.input}
                    onChange={(e) => setHiddenInput({ ...hiddenInput, input: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <input
                    type="text"
                    placeholder="Expected Output"
                    value={hiddenInput.expected}
                    onChange={(e) => setHiddenInput({ ...hiddenInput, expected: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                  <button
                    type="button"
                    onClick={addHiddenTestCase}
                    className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {formData.hidden_test_cases.map((tc, index) => (
                  <div key={index} className="flex items-center justify-between mt-2 p-2 bg-gray-50 rounded-md">
                    <span className="text-sm">Input: {tc.input} → Expected: {tc.expected}</span>
                    <button
                      type="button"
                      onClick={() => removeHiddenTestCase(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Topic"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            />

            <Select
              label="Difficulty"
              options={difficultyOptions}
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Role (e.g., Python Developer)"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">Tags</label>
              <p className="text-xs text-gray-400 mb-2">Tags help categorize and search questions</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="Add tag..."
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-100 rounded-md text-sm flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" isLoading={isLoading}>
              {isEdit ? 'Update Question' : 'Create Question'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/questions')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}