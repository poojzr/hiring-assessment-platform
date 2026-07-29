import { useState, useRef, useEffect } from 'react'

export function useCamera(options = {}) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)
  const [stream, setStream] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const defaultOptions = {
    facingMode: 'user',
    width: 640,
    height: 480,
    ...options
  }

  const start = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: defaultOptions,
        audio: false
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
        setIsReady(true)
        setError(null)
      }
      return true
    } catch (err) {
      setError(err.message)
      setIsReady(false)
      return false
    }
  }

  const stop = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsReady(false)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) {
      return null
    }
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    canvas.width = video.videoWidth || defaultOptions.width
    canvas.height = video.videoHeight || defaultOptions.height
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    return canvas.toDataURL('image/jpeg', 0.95)
  }

  const captureRaw = () => {
    if (!videoRef.current || !canvasRef.current) {
      return null
    }
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    canvas.width = video.videoWidth || defaultOptions.width
    canvas.height = video.videoHeight || defaultOptions.height
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    return canvas
  }

  const toggle = async () => {
    if (isReady) {
      stop()
    } else {
      await start()
    }
    return isReady
  }

  useEffect(() => {
    return () => {
      stop()
    }
  }, [])

  return {
    videoRef,
    canvasRef,
    isReady,
    error,
    stream,
    start,
    stop,
    capture,
    captureRaw,
    toggle
  }
}