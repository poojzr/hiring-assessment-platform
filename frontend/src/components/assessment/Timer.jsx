import { useState, useEffect, useRef } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

export default function Timer({ durationMinutes, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60)
  const onTimeUpRef = useRef(onTimeUp)

  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  }, [onTimeUp])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          if (onTimeUpRef.current) onTimeUpRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const isWarning = timeLeft < 300
  const isCritical = timeLeft < 60

  return (
    <div className={`flex items-center gap-2 font-mono text-lg font-semibold ${
      isCritical ? 'text-red-600 animate-pulse' :
      isWarning ? 'text-yellow-600' :
      'text-gray-700'
    }`}>
      {isWarning && <AlertTriangle className={`w-4 h-4 ${isCritical ? 'text-red-500' : 'text-yellow-500'}`} />}
      <Clock className={`w-4 h-4 ${isWarning ? 'text-yellow-500' : 'text-gray-400'}`} />
      {formatTime(timeLeft)}
    </div>
  )
}