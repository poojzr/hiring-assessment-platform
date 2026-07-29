import { useState } from 'react'
import { AlertTriangle, Video, VideoOff, Mic, MicOff, Monitor, Eye, EyeOff, Volume2, VolumeX, Smartphone, Users, Shield } from 'lucide-react'

export default function ProctorMonitor({ 
  violations, 
  integrityScore, 
  cheatingRisk,
  tabSwitchCount,
  isFullscreen,
  isCameraOn,
  isMicOn,
  isStreaming
}) {
  const [expanded, setExpanded] = useState(false)

  const getSeverityColor = (severity) => {
    const map = {
      critical: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300'
    }
    return map[severity] || 'bg-gray-100 text-gray-700 border-gray-300'
  }

  const getStatusIcon = (status, type) => {
    if (type === 'camera') {
      return status ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />
    }
    if (type === 'mic') {
      return status ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />
    }
    if (type === 'fullscreen') {
      return status ? <Monitor className="w-3 h-3" /> : <Monitor className="w-3 h-3" />
    }
    return null
  }

  const getStatusColor = (status) => {
    return status ? 'text-green-600' : 'text-red-600'
  }

  const recentViolations = violations.slice(-5).reverse()

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div 
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Shield className={`w-5 h-5 ${integrityScore >= 90 ? 'text-green-500' : integrityScore >= 70 ? 'text-yellow-500' : 'text-red-500'}`} />
          <span className="text-sm font-medium">Proctor Monitor</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            integrityScore >= 90 ? 'bg-green-100 text-green-700' : 
            integrityScore >= 70 ? 'bg-yellow-100 text-yellow-700' : 
            'bg-red-100 text-red-700'
          }`}>
            {integrityScore}%
          </span>
          {cheatingRisk && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              cheatingRisk === 'clean' ? 'bg-green-100 text-green-700' :
              cheatingRisk === 'minor' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {cheatingRisk}
            </span>
          )}
          {violations.length > 0 && (
            <span className="text-xs text-red-600 font-medium">
              {violations.length} violation{violations.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className={`flex items-center gap-1 ${getStatusColor(isStreaming)}`}>
            {isStreaming ? '●' : '○'} Live
          </div>
          <div className={`flex items-center gap-1 ${getStatusColor(isCameraOn)}`}>
            {getStatusIcon(isCameraOn, 'camera')}
          </div>
          <div className={`flex items-center gap-1 ${getStatusColor(isMicOn)}`}>
            {getStatusIcon(isMicOn, 'mic')}
          </div>
          <div className={`flex items-center gap-1 ${getStatusColor(isFullscreen)}`}>
            {getStatusIcon(isFullscreen, 'fullscreen')}
          </div>
          <span className="text-gray-400 ml-1">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Monitor className={`w-4 h-4 ${isFullscreen ? 'text-green-500' : 'text-red-500'}`} />
              <span className="text-gray-600">Fullscreen:</span>
              <span className={isFullscreen ? 'text-green-600' : 'text-red-600'}>
                {isFullscreen ? 'On' : 'Off'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Video className={`w-4 h-4 ${isCameraOn ? 'text-green-500' : 'text-red-500'}`} />
              <span className="text-gray-600">Camera:</span>
              <span className={isCameraOn ? 'text-green-600' : 'text-red-600'}>
                {isCameraOn ? 'On' : 'Off'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mic className={`w-4 h-4 ${isMicOn ? 'text-green-500' : 'text-red-500'}`} />
              <span className="text-gray-600">Mic:</span>
              <span className={isMicOn ? 'text-green-600' : 'text-red-600'}>
                {isMicOn ? 'On' : 'Off'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              <span>Violations: {violations.length}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
              <Eye className="w-3 h-3 text-blue-500" />
              <span>Tab Switches: {tabSwitchCount}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
              <Users className="w-3 h-3 text-red-500" />
              <span>Multiple Faces: {violations.filter(v => v.type === 'MULTIPLE_FACE').length}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
              <Smartphone className="w-3 h-3 text-orange-500" />
              <span>Mobile Detected: {violations.filter(v => v.type === 'MOBILE_DETECTED').length}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
              <Volume2 className="w-3 h-3 text-purple-500" />
              <span>Loud Voice: {violations.filter(v => v.type === 'LOUD_VOICE').length}</span>
            </div>
          </div>

          {recentViolations.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">Recent Violations</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {recentViolations.map((v, i) => (
                  <div key={i} className={`flex items-center justify-between px-2 py-1 rounded text-xs border ${getSeverityColor(v.severity)}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="font-medium">{v.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{v.severity}</span>
                      <span className="text-gray-400">
                        {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}