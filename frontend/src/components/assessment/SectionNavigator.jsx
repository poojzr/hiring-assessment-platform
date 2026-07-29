import { CheckCircle } from 'lucide-react'

export default function SectionNavigator({ questions, currentIndex, answers, onSelect }) {
  const getAnsweredCount = () => {
    return Object.keys(answers).filter(id => answers[id] && Object.keys(answers[id]).length > 0).length
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sticky top-20">
      <h3 className="text-sm font-semibold text-navy-800 mb-3">Questions</h3>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, index) => {
          const isAnswered = answers[q.id] && Object.keys(answers[q.id]).length > 0
          const isCurrent = index === currentIndex
          
          return (
            <button
              key={q.id}
              onClick={() => onSelect(index)}
              className={`relative flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                isCurrent
                  ? 'bg-accent-500 text-white'
                  : isAnswered
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {index + 1}
              {isAnswered && !isCurrent && (
                <CheckCircle className="absolute -top-1 -right-1 w-3 h-3 text-green-600" />
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-accent-500 rounded"></div>
            <span className="text-gray-600">Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-gray-600">Answered</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></div>
            <span className="text-gray-600">Unanswered</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {getAnsweredCount()} of {questions.length} answered
        </div>
      </div>
    </div>
  )
}