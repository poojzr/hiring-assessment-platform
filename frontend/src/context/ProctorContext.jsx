import React, { createContext, useContext, useState, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useCamera } from '../hooks/useCamera'
import { useMicrophone } from '../hooks/useMicrophone'

const ProctorContext = createContext(null)

export function ProctorProvider({ children }) {
  const [violations, setViolations] = useState([])
  const [integrityScore, setIntegrityScore] = useState(100)
  const [cheatingRisk, setCheatingRisk] = useState('clean')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(true)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const wsRef = useRef(null)

  const camera = useCamera()
  const microphone = useMicrophone()

  const connectWebSocket = (sessionId, token) => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    const url = `${wsUrl}/api/proctor/live/${sessionId}?token=${token}`
    
    wsRef.current = new WebSocket(url)

    wsRef.current.onopen = () => {
      setIsStreaming(true)
    }

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'violation') {
        setViolations(prev => [...prev, data.violation])
        updateIntegrity(data.violation.severity)
      }
      if (data.type === 'warning') {
        console.warn('Proctor warning:', data.message)
      }
      if (data.type === 'terminated') {
        setIsStreaming(false)
      }
      if (data.type === 'integrity_update') {
        setIntegrityScore(data.score)
        setCheatingRisk(data.risk)
      }
    }

    wsRef.current.onerror = () => {
      setIsStreaming(false)
    }

    wsRef.current.onclose = () => {
      setIsStreaming(false)
    }

    return wsRef.current
  }

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsStreaming(false)
  }

  const updateIntegrity = (severity) => {
    let penalty = 0
    if (severity === 'critical') penalty = 40
    else if (severity === 'high') penalty = 25
    else if (severity === 'medium') penalty = 10
    else if (severity === 'low') penalty = 5
    
    setIntegrityScore(prev => Math.max(0, prev - penalty))
    
    const score = integrityScore - penalty
    if (score >= 90) setCheatingRisk('clean')
    else if (score >= 70) setCheatingRisk('minor')
    else setCheatingRisk('high')
  }

  const logViolation = (type, severity) => {
    const violation = {
      type,
      severity,
      timestamp: new Date().toISOString()
    }
    setViolations(prev => [...prev, violation])
    updateIntegrity(severity)
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'violation',
        data: violation
      }))
    }
  }

  const sendFrame = async () => {
    if (!camera.isReady || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    
    const frameData = camera.capture()
    if (frameData) {
      const base64Data = frameData.split(',')[1]
      wsRef.current.send(JSON.stringify({
        type: 'frame',
        data: base64Data
      }))
    }
  }

  const sendAudio = () => {
    if (!microphone.isReady || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    
    const audioData = microphone.getAudioData()
    if (audioData) {
      const audioBase64 = btoa(String.fromCharCode.apply(null, audioData))
      wsRef.current.send(JSON.stringify({
        type: 'audio',
        data: audioBase64
      }))
    }
  }

  const toggleCamera = async () => {
    if (isCameraOn) {
      camera.stop()
    } else {
      await camera.start()
    }
    setIsCameraOn(!isCameraOn)
  }

  const toggleMicrophone = async () => {
    if (isMicOn) {
      microphone.stop()
    } else {
      await microphone.start()
    }
    setIsMicOn(!isMicOn)
  }

  const reset = () => {
    setViolations([])
    setIntegrityScore(100)
    setCheatingRisk('clean')
    setTabSwitchCount(0)
    disconnectWebSocket()
    camera.stop()
    microphone.stop()
    setIsCameraOn(false)
    setIsMicOn(false)
    setIsStreaming(false)
  }

  const value = {
    violations,
    integrityScore,
    cheatingRisk,
    isStreaming,
    isCameraOn,
    isMicOn,
    isFullscreen,
    tabSwitchCount,
    camera,
    microphone,
    connectWebSocket,
    disconnectWebSocket,
    logViolation,
    sendFrame,
    sendAudio,
    toggleCamera,
    toggleMicrophone,
    setIsFullscreen,
    setTabSwitchCount,
    reset
  }

  return (
    <ProctorContext.Provider value={value}>
      {children}
    </ProctorContext.Provider>
  )
}

export function useProctor() {
  const context = useContext(ProctorContext)
  if (!context) {
    throw new Error('useProctor must be used within a ProctorProvider')
  }
  return context
}