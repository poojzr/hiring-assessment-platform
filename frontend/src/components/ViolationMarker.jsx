import { useState } from 'react'
import { AlertTriangle, Play, Download } from 'lucide-react'

export default function ViolationMarker({ violation, onPlay, onDownload }) {
  const [expanded, setExpanded] = useState(false)

  const getSeverityColor = (severity) => {
    const map = {
      critical: 'border-red-500 bg-red-50',
      high: 'border-orange-500 bg-orange-50',
      medium: 'border-yellow-500 bg-yellow-50',
      low: 'border-blue-500 bg-blue-50'
    }
    return map[severity] || 'border-gray-500 bg-gray-50'
  }

  const getSeverityBadgeColor = (severity) => {
    const map = {
      critical: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-blue-500 text-white'
    }
    return map[severity] || 'bg-gray-500 text-white'
  }

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className={`border-l-4 rounded-r-lg p-3 mb-2 ${getSeverityColor(violation.severity)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-4 h-4 ${
            violation.severity === 'critical' ? 'text-red-500' :
            violation.severity === 'high' ? 'text-orange-500' :
            violation.severity === 'medium' ? 'text-yellow-500' :
            'text-blue-500'
          }`} />
          <div>
            <p className="text-sm font-medium text-navy-800">{violation.type}</p>
            <p className="text-xs text-gray-500">
              {violation.timestamp ? new Date(violation.timestamp).toLocaleString() : formatTime(violation.time)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityBadgeColor(violation.severity)}`}>
            {violation.severity}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-500">Type</p>
              <p className="font-medium text-navy-800">{violation.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Severity</p>
              <p className="font-medium text-navy-800 capitalize">{violation.severity}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Time</p>
              <p className="font-medium text-navy-800">{formatTime(violation.time)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Timestamp</p>
              <p className="font-medium text-navy-800">
                {violation.timestamp ? new Date(violation.timestamp).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {violation.time !== undefined && (
              <button
                onClick={() => onPlay(violation.time)}
                className="flex items-center gap-1 px-3 py-1 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 transition-colors"
              >
                <Play className="w-3 h-3" />
                Play at {formatTime(violation.time)}
              </button>
            )}
            {violation.clip_url && (
              <button
                onClick={() => onDownload(violation.clip_url)}
                className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download Clip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}