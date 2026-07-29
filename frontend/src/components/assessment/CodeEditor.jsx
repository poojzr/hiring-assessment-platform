import { useState, useEffect, useRef } from 'react'
import { Play, Loader2, CheckCircle, XCircle, ChevronDown, Code, Terminal, Bug } from 'lucide-react'
import toast from 'react-hot-toast'
import { runCode } from '../../api/assessments'
import { useParams } from 'react-router-dom'

export default function CodeEditor({ value, onChange, language, publicTestCases, questionId, supportedLanguages, allowLanguageChoice }) {
  const { accessToken } = useParams()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState(language || 'python')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [editorLines, setEditorLines] = useState(1)
  const textareaRef = useRef(null)

  const availableLanguages = supportedLanguages && supportedLanguages.length > 0 
    ? supportedLanguages 
    : [language || 'python']

  useEffect(() => {
    if (language && availableLanguages.includes(language)) {
      setSelectedLanguage(language)
    }
  }, [language, availableLanguages])

  const languageDisplay = {
    python: 'Python',
    javascript: 'JavaScript',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#'
  }

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang)
    setIsDropdownOpen(false)
    onChange({ code: value, language: lang })
  }

  const handleCodeChange = (e) => {
    const newCode = e.target.value
    const lines = newCode.split('\n').length
    setEditorLines(Math.max(lines, 1))
    onChange({ code: newCode, language: selectedLanguage })
  }

  const handleRun = async () => {
    if (!value.trim()) {
      toast.error('Please write some code first')
      return
    }

    setRunning(true)
    setResults(null)
    setError(null)

    try {
      const response = await runCode(accessToken, questionId, value, selectedLanguage)
      setResults(response)
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to run code'
      setError(message)
      toast.error(message)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      const lines = value.split('\n').length
      setEditorLines(Math.max(lines, 1))
    }
  }, [value])

  const showLanguageSelector = allowLanguageChoice && availableLanguages.length > 1

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code className="w-4 h-4 text-gray-400" />
          {showLanguageSelector ? (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors bg-gray-700 border-gray-600"
              >
                <span className="text-white">{languageDisplay[selectedLanguage] || selectedLanguage}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-10 min-w-[140px]">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                        selectedLanguage === lang ? 'bg-gray-700 text-white' : 'text-gray-300'
                      }`}
                    >
                      {languageDisplay[lang] || lang}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-white text-sm font-medium">
              {languageDisplay[selectedLanguage] || selectedLanguage}
            </span>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run Code
        </button>
      </div>

      <div className="flex bg-gray-900">
        <div className="flex-shrink-0 w-12 bg-gray-800/50 text-right pr-3 py-4 select-none">
          {Array.from({ length: Math.min(editorLines, 50) }, (_, i) => (
            <div key={i + 1} className="text-xs text-gray-600 leading-6">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleCodeChange}
          className="w-full font-mono text-sm p-4 bg-gray-900 text-gray-200 focus:outline-none min-h-[250px] resize-y leading-6"
          placeholder={`Write your ${selectedLanguage.toUpperCase()} code here...`}
          spellCheck={false}
          style={{ tabSize: 4 }}
        />
      </div>

      {publicTestCases && publicTestCases.length > 0 && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Terminal className="w-3 h-3" />
            <span>{publicTestCases.length} public test case(s) available</span>
          </div>
        </div>
      )}

      {results && (
        <div className="border-t border-gray-700">
          <div className={`px-4 py-2 text-sm font-medium ${
            results.passed ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}>
            {results.passed ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                All {results.total} test cases passed!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {results.passed_count} of {results.total} test cases passed
              </span>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto bg-gray-800">
            {results.results?.map((testCase, index) => (
              <div key={index} className={`px-4 py-2 border-t border-gray-700 text-sm ${
                testCase.passed ? 'text-green-400' : 'text-red-400'
              }`}>
                <span className="font-medium text-gray-400">Test {index + 1}:</span>
                {testCase.error ? (
                  <span className="ml-2 text-red-400">{testCase.error}</span>
                ) : (
                  <>
                    <span className="ml-2 text-gray-400">Input: {testCase.input}</span>
                    <span className="ml-2 text-gray-400">Expected: {testCase.expected}</span>
                    <span className="ml-2">{testCase.passed ? 'PASS' : 'FAIL'}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="border-t border-gray-700 p-4 bg-red-900/30 text-sm text-red-400">
          <Bug className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}
    </div>
  )
}