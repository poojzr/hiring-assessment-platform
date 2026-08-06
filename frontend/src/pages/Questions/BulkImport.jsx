import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { bulkImportQuestions } from '../../api/questions'
import Button from '../../components/ui/Button'

export default function BulkImport() {
  const [file, setFile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [errors, setErrors] = useState([])
  const navigate = useNavigate()

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase()
      if (!['csv', 'json'].includes(ext)) {
        toast.error('Only CSV and JSON files are supported')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setErrors([])
      setResults(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setIsLoading(true)
    setErrors([])
    setResults(null)

    try {
      const response = await bulkImportQuestions(file)
      setResults(response)
      
      const failedItems = response.results?.filter(r => r.status === 'failed') || []
      if (failedItems.length > 0) {
        setErrors(failedItems.map(r => r.error || 'Unknown error'))
      }
      
      const successCount = response.results?.filter(r => r.status === 'success').length || 0
      if (successCount > 0) {
        toast.success(`Imported ${successCount} questions successfully`)
      }
      if (failedItems.length > 0) {
        toast.error(`${failedItems.length} questions failed to import`)
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to import questions'
      toast.error(message)
      setErrors([message])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl px-4 sm:px-0">
      <button onClick={() => navigate('/app/questions')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm sm:text-base">Back to Questions</span>
      </button>

      <h1 className="text-xl sm:text-2xl font-bold text-navy-800 mb-6">Bulk Import Questions</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Supported Formats</h3>
          <div className="flex flex-wrap gap-2 sm:gap-4 text-sm text-gray-500">
            <span className="px-3 py-1 bg-gray-100 rounded">CSV</span>
            <span className="px-3 py-1 bg-gray-100 rounded">JSON</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            For CSV: public_test_cases and hidden_test_cases should be valid JSON arrays
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center">
            <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              {file ? file.name : 'Drag and drop your CSV or JSON file here'}
            </p>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="inline-block px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-md font-medium transition-colors cursor-pointer text-sm sm:text-base">
              Choose File
            </label>
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !file}
            className="w-full bg-accent-500 hover:bg-accent-600 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {isLoading ? 'Importing...' : 'Upload and Import'}
          </button>
        </form>

        {errors.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-medium text-red-600 mb-3 text-sm sm:text-base">Import Errors</h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {errors.map((error, index) => (
                <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded break-words">
                  <AlertCircle className="w-4 h-4 inline mr-1 flex-shrink-0" />
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {results && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-medium text-navy-800 mb-3 text-sm sm:text-base">Import Results</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="bg-gray-50 p-3 rounded text-center">
                <p className="text-xl sm:text-2xl font-bold text-navy-800">{results.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="bg-green-50 p-3 rounded text-center">
                <p className="text-xl sm:text-2xl font-bold text-green-600">
                  {results.results?.filter(r => r.status === 'success').length || 0}
                </p>
                <p className="text-xs text-gray-500">Success</p>
              </div>
              <div className="bg-red-50 p-3 rounded text-center">
                <p className="text-xl sm:text-2xl font-bold text-red-600">
                  {results.results?.filter(r => r.status === 'failed').length || 0}
                </p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
            </div>
            {results.results && results.results.length > 0 && (
              <div className="mt-4 max-h-48 overflow-y-auto">
                {results.results.map((r, index) => (
                  <div key={index} className={`text-sm p-1 ${r.status === 'success' ? 'text-green-600' : 'text-red-600'} break-words`}>
                    {r.status === 'success' ? '✓' : '✗'} {r.text || r.error || 'Unknown'}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}