import { useState, useRef, useEffect } from 'react'

export function useMicrophone(options = {}) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [stream, setStream] = useState(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const animationFrameRef = useRef(null)

  const defaultOptions = {
    audio: true,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...options
  }

  const start = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: defaultOptions,
        video: false
      })
      setStream(mediaStream)

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(mediaStream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      
      setIsReady(true)
      setError(null)
      startLevelMonitoring()
      return true
    } catch (err) {
      setError(err.message)
      setIsReady(false)
      return false
    }
  }

  const startLevelMonitoring = () => {
    const updateLevel = () => {
      if (!analyserRef.current || !dataArrayRef.current) return
      
      analyserRef.current.getByteFrequencyData(dataArrayRef.current)
      const average = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length
      const normalized = Math.min(1, average / 128)
      setAudioLevel(normalized)
      
      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }
    updateLevel()
  }

  const stop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsReady(false)
    setAudioLevel(0)
  }

  const getAudioData = () => {
    if (!analyserRef.current || !dataArrayRef.current) {
      return null
    }
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    return dataArrayRef.current
  }

  const isLoud = (threshold = 0.3) => {
    return audioLevel > threshold
  }

  const isVeryLoud = (threshold = 0.7) => {
    return audioLevel > threshold
  }

  useEffect(() => {
    return () => {
      stop()
    }
  }, [])

  return {
    isReady,
    error,
    stream,
    audioLevel,
    isLoud,
    isVeryLoud,
    getAudioData,
    start,
    stop
  }
}