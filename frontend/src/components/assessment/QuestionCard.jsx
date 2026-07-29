import { useState } from 'react'
import { Code2, HelpCircle, CheckCircle, FileCode } from 'lucide-react'
import CodeEditor from './CodeEditor'

export default function QuestionCard({ question, answer, onChange }) {
  const [showHint, setShowHint] = useState(false)

  if (!question) return null

  const handleMCQChange = (optionKey) => {
    onChange({ answer: optionKey })
  }

  const handleCodeChange = (data) => {
    onChange({ code: data.code, language: data.language })
  }

  const supportedLanguages = question.supported_languages || [question.language || 'python']
  const allowLanguageChoice = question.allow_language_choice !== undefined ? question.allow_language_choice : false

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-gray-800 leading-relaxed">{question.text}</p>
        </div>
        {question.description && (
          <button
            onClick={() => setShowHint(!showHint)}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Show description"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {showHint && question.description && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p className="font-medium text-blue-800">Hint:</p>
          <p className="mt-1">{question.description}</p>
        </div>
      )}

      {question.type === 'MCQ' && question.options && (
        <div className="space-y-2 mt-4">
          {Object.entries(question.options).map(([key, value]) => {
            const isSelected = answer?.answer === key
            return (
              <label
                key={key}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-accent-500 bg-accent-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-accent-500 bg-accent-500' : 'border-gray-300'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={key}
                  checked={isSelected}
                  onChange={() => handleMCQChange(key)}
                  className="hidden"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium text-gray-500">{key}.</span> {value}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {question.type === 'CODING' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <FileCode className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Code Editor</span>
            {allowLanguageChoice && (
              <span className="text-xs text-gray-400 ml-2">(Multiple languages available)</span>
            )}
          </div>
          <CodeEditor
            value={answer?.code || ''}
            onChange={handleCodeChange}
            language={answer?.language || question.language || 'python'}
            supportedLanguages={supportedLanguages}
            allowLanguageChoice={allowLanguageChoice}
            publicTestCases={question.public_test_cases || []}
            questionId={question.id}
          />
        </div>
      )}
    </div>
  )
}