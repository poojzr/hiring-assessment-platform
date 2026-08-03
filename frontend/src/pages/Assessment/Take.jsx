import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, AlertCircle, Save, Video, VideoOff, Mic, MicOff, MessageSquare, Send, Clock, CheckCircle, HelpCircle, FileCode, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAssessment, saveAnswer, submitAssessment, startAssessment } from '../../api/assessments'
import apiClient from '../../api/client'
import { uploadRecordingChunk } from '../../api/recording'
import Timer from '../../components/assessment/Timer'
import QuestionCard from '../../components/assessment/QuestionCard'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import { getVideoDuration } from '../../utils/thumbnail'

export default function AssessmentTake() {
  const { accessToken } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const wsRef = useRef(null)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingIntervalRef = useRef(null)
  const audioAnalysisIntervalRef = useRef(null)
  const chatEndRef = useRef(null)
  const isCameraOnRef = useRef(true)
  const lastViolationSentRef = useRef({})
  const chunkIndexRef = useRef(0)
  const [assessment, setAssessment] = useState(null)
  const [questions, setQuestions] = useState([])
  const [sections, setSections] = useState([])
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [error, setError] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(true)
  const [recordingQuality, setRecordingQuality] = useState('medium')
  const [sessionId, setSessionId] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const saveTimeout = useRef(null)
  const [answeredState, setAnsweredState] = useState({})
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [mediaRecorderReady, setMediaRecorderReady] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    isCameraOnRef.current = isCameraOn
  }, [isCameraOn])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  useEffect(() => {
    const fetchAssessment = async () => {
      setLoading(true)
      try {
        const data = await getAssessment(accessToken)
        setAssessment(data)

        const sessionIdFromData = data.session_id || data.id
        setSessionId(sessionIdFromData)

        try {
          const historyRes = await apiClient.get(`/proctor/sessions/${sessionIdFromData}/chat`)
          const history = (historyRes.data || []).map((m) => ({
            sender: m.sender,
            message: m.message,
            timestamp: new Date(m.timestamp).toLocaleTimeString()
          }))
          setChatMessages(history)
        } catch (historyError) {
          console.error('Failed to load chat history:', historyError)
        }

        const qs = data.questions || []
        setQuestions(qs)
        setTotalQuestions(qs.length)

        const sectionsConfig = data.sections_config || { sections: [] }
        const sectionsList = sectionsConfig.sections || []

        if (sectionsList.length > 0) {
          let startIndex = 0
          const parsedSections = sectionsList.map((section) => {
            const count = section.count || 0
            const sectionQuestions = qs.slice(startIndex, startIndex + count)
            startIndex += count
            const type = section.type || 'MIXED'
            const displayType = type === 'MCQ' ? 'Multiple Choice' : type === 'CODING' ? 'Coding' : 'Mixed'
            return {
              ...section,
              type: type,
              displayType: displayType,
              questions: sectionQuestions,
              startIndex: startIndex - count,
              endIndex: startIndex
            }
          })
          setSections(parsedSections)
        } else {
          setSections([{
            id: 'section_1',
            type: 'MIXED',
            displayType: 'Mixed',
            questions: qs,
            startIndex: 0,
            endIndex: qs.length
          }])
        }

        if (data.status !== 'in_progress') {
          await startAssessment(accessToken)
        }

        setTimeout(() => {
          startProctoring(sessionIdFromData)
        }, 1000)
        setupFullscreenDetection()
        setupTabSwitchDetection()
        setupCopyPasteDetection()
        setupContextMenuDetection()
      } catch (error) {
        const message = error.response?.data?.detail || 'Failed to load assessment'
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }
    fetchAssessment()

    return () => {
      stopProctoring()
      stopRecording()
      if (audioAnalysisIntervalRef.current) {
        clearInterval(audioAnalysisIntervalRef.current)
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('copy', handleCopyPaste)
      document.removeEventListener('paste', handleCopyPaste)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [accessToken])

  const sendViolation = (eventType, severity = 'medium') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'violation',
        event: eventType,
        severity: severity
      }))
    }
  }

  const sendViolationThrottled = (eventType, severity, cooldownMs) => {
    const nowTs = Date.now()
    const last = lastViolationSentRef.current[eventType] || 0
    if (nowTs - last < cooldownMs) return
    lastViolationSentRef.current[eventType] = nowTs
    sendViolation(eventType, severity)
  }

  const setupFullscreenDetection = () => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
  }

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      setIsFullscreen(false)
      sendViolationThrottled('FULLSCREEN_EXIT', 'medium', 5000)
    } else {
      setIsFullscreen(true)
    }
  }

  const setupTabSwitchDetection = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      sendViolationThrottled('TAB_SWITCH', 'medium', 5000)
    }
  }

  const setupCopyPasteDetection = () => {
    document.addEventListener('copy', handleCopyPaste)
    document.addEventListener('paste', handleCopyPaste)
  }

  const handleCopyPaste = (e) => {
    sendViolationThrottled('COPY_PASTE', 'medium', 5000)
  }

  const setupContextMenuDetection = () => {
    document.addEventListener('contextmenu', handleContextMenu)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
  }

  const sendChatMessage = () => {
    if (!chatInput.trim()) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to proctor')
      return
    }

    const messageData = {
      type: 'chat',
      message: chatInput.trim(),
      sender: 'candidate'
    }

    wsRef.current.send(JSON.stringify(messageData))

    setChatMessages(prev => [...prev, {
      sender: 'candidate',
      message: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString()
    }])
    setChatInput('')
  }

  const startProctoring = async (resolvedSessionId) => {
    let wsSessionId = resolvedSessionId || sessionId || accessToken

    if (!wsSessionId) {
      toast.error('Session ID not available. Please refresh.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: {
          autoGainControl: false,
          noiseSuppression: false,
          echoCancellation: true
        }
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsCameraOn(true)
      }

      startRecording(stream, wsSessionId)

      const token = accessToken
      const wsBase = import.meta.env.VITE_WS_URL 
      const wsUrl = `${wsBase}/api/proctor/live/${wsSessionId}?token=${token}`

      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        setIsStreaming(true)
        startStreaming()
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'warning') {
            toast(data.message ? ('Proctor warning: ' + data.message) : 'Proctor warning', {
              duration: 10000,
              style: {
                border: '1px solid #F59E0B',
                padding: '16px',
                color: '#92400E',
                backgroundColor: '#FEF3C7'
              }
            })
          }

          if (data.type === 'terminated') {
            toast.error('Session terminated by proctor: ' + data.reason)
            stopProctoring()
            stopRecording()
            navigate(`/assessment/${accessToken}/thankyou`)
          }

          if (data.type === 'chat') {
            const sender = data.sender || 'proctor'
            setChatMessages(prev => [...prev, {
              sender: sender,
              message: data.message,
              timestamp: new Date().toLocaleTimeString()
            }])
            if (sender === 'proctor') {
              toast('Proctor: ' + data.message, { duration: 5000 })
            }
          }

          if (data.type === 'toggle_camera') {
            setIsCameraOn(data.enabled)
          }

          if (data.type === 'toggle_microphone') {
            setIsMicOn(data.enabled)
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e)
        }
      }

      wsRef.current.onerror = (error) => {
        setIsStreaming(false)
      }

      wsRef.current.onclose = () => {
        setIsStreaming(false)
      }

    } catch (error) {
      console.error('Failed to start proctoring:', error)
      toast.error('Camera or microphone access denied. Proctoring will be limited.')
    }
  }

  const startRecording = (stream, uploadSessionId) => {
    try {
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 2000000,
          audioBitsPerSecond: 128000
        })
        setRecordingQuality('high')
      } catch (e) {
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 1000000,
          audioBitsPerSecond: 96000
        })
        setRecordingQuality('medium')
      }

      recordedChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        if (recordedChunksRef.current.length === 0) return

        const blob = new Blob(recordedChunksRef.current, {
          type: mediaRecorderRef.current.mimeType || 'video/webm'
        })
        recordedChunksRef.current = []

        let durationValue = 0
        try {
          durationValue = await getVideoDuration(blob)
        } catch (e) {
          durationValue = 0
        }

        const currentChunkIndex = chunkIndexRef.current
        const safeDuration = (typeof durationValue === 'number' && isFinite(durationValue) && durationValue >= 0)
          ? Math.round(durationValue)
          : 0

        try {
          await uploadRecordingChunk(
            uploadSessionId,
            blob,
            currentChunkIndex,
            safeDuration,
            recordingQuality
          )
          chunkIndexRef.current += 1
        } catch (error) {
          console.error('Failed to upload recording chunk:', error)
          toast.error(`Failed to upload recording chunk ${currentChunkIndex + 1}`)
        }
      }

      mediaRecorderRef.current.start(10000)
      setMediaRecorderReady(true)

      recordingIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop()
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
              mediaRecorderRef.current.start(10000)
            }
          }, 100)
        }
      }, 15000)
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const startStreaming = () => {
    if (!streamRef.current || !wsRef.current) return

    const videoTrack = streamRef.current.getVideoTracks()[0]
    const imageCapture = new ImageCapture(videoTrack)

    const sendFrame = async () => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        setTimeout(sendFrame, 5000)
        return
      }

      try {
        const bitmap = await imageCapture.grabFrame()
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 240
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap, 0, 0, 320, 240)

        canvas.toBlob(async (blob) => {
          if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
            const buffer = await blob.arrayBuffer()
            wsRef.current.send(buffer)
          }
        }, 'image/jpeg', 0.5)
      } catch (error) {
      }

      setTimeout(sendFrame, 200)
    }

    sendFrame()

    const audioContext = new AudioContext()
    audioContextRef.current = audioContext
    const source = audioContext.createMediaStreamSource(streamRef.current)
    const processor = audioContext.createScriptProcessor(2048, 1, 1)
    source.connect(processor)
    processor.connect(audioContext.destination)

    processor.onaudioprocess = (e) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0)

        const bytes = new Uint8Array(inputData.buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const audioBase64 = btoa(binary)
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: audioBase64
        }))
      }
    }
  }

  const stopProctoring = () => {
    setIsStreaming(false)

    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch (e) {}
      wsRef.current = null
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          track.stop()
        })
      } catch (e) {}
      streamRef.current = null
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (e) {}
      audioContextRef.current = null
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null
      } catch (e) {}
    }

    stopRecording()

    setIsCameraOn(false)
    setIsMicOn(false)
  }

  const toggleCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getVideoTracks()
      tracks.forEach(track => {
        track.enabled = !track.enabled
      })
      setIsCameraOn(!isCameraOn)
      if (!isCameraOn) {
        toast.success('Camera turned on')
      } else {
        toast.error('Camera turned off')
      }
    }
  }

  const toggleMicrophone = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getAudioTracks()
      tracks.forEach(track => {
        track.enabled = !track.enabled
      })
      setIsMicOn(!isMicOn)
      if (!isMicOn) {
        toast.success('Microphone turned on')
      } else {
        toast.error('Microphone turned off')
      }
    }
  }

  const handleAnswerChange = (questionId, answerData) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerData
    }))

    setAnsweredState(prev => ({
      ...prev,
      [questionId]: false
    }))

    setSaveError(false)
    updateAnsweredCount()

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current)
    }
    saveTimeout.current = setTimeout(() => {
      handleSaveAnswer(questionId, answerData)
    }, 1000)
  }

  const handleSaveAnswer = async (questionId, answerData) => {
    setSaving(true)
    setSaveError(false)
    try {
      await saveAnswer(accessToken, questionId, answerData)
      setAnsweredState(prev => ({
        ...prev,
        [questionId]: true
      }))
      setSaveError(false)
      updateAnsweredCount()
    } catch (error) {
      console.error('Failed to save answer:', error)
      setSaveError(true)
      toast.error('Failed to save answer')
    } finally {
      setSaving(false)
    }
  }

  const updateAnsweredCount = () => {
    const count = Object.keys(answers).filter(id => answers[id] && Object.keys(answers[id]).length > 0).length
    setAnsweredCount(count)
  }

  const handleSubmitAssessment = async (autoSubmit = false) => {
    if (!autoSubmit && !window.confirm('Are you sure you want to submit?')) return

    setSubmitting(true)
    try {
      const answerList = Object.keys(answers).map(qId => ({
        question_id: parseInt(qId),
        answer_data: answers[qId]
      }))
      await submitAssessment(accessToken, answerList)

      stopProctoring()
      stopRecording()

      toast.success('Assessment submitted successfully')
      navigate(`/assessment/${accessToken}/thankyou`)
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit assessment'
      toast.error(message)
      setSubmitting(false)
      setShowSubmitModal(false)
    }
  }

  const getGlobalQuestionIndex = (sectionIdx, localIdx) => {
    const section = sections[sectionIdx]
    if (!section) return 0
    return section.startIndex + localIdx
  }

  const getCurrentQuestion = () => {
    const section = sections[currentSectionIndex]
    if (!section || !section.questions || section.questions.length === 0) return null
    return section.questions[currentQuestionIndex] || null
  }

  const goToNextQuestion = () => {
    const section = sections[currentSectionIndex]
    if (!section) return

    if (currentQuestionIndex < section.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1)
      setCurrentQuestionIndex(0)
    }
  }

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1)
      const prevSection = sections[currentSectionIndex - 1]
      setCurrentQuestionIndex(prevSection ? prevSection.questions.length - 1 : 0)
    }
  }

  const getQuestionStatus = (q, sectionIdx, localIdx) => {
    const isAnswered = answeredState[q.id] || (answers[q.id] && Object.keys(answers[q.id]).length > 0)
    const isCurrent = currentSectionIndex === sectionIdx && currentQuestionIndex === localIdx
    if (isCurrent) return 'current'
    if (isAnswered) return 'answered'
    return 'unanswered'
  }

  const getSectionTypeLabel = (type) => {
    if (type === 'MCQ') return 'Multiple Choice'
    if (type === 'CODING') return 'Coding'
    return 'Mixed'
  }

  const getSectionIcon = (type) => {
    if (type === 'CODING') return <FileCode className="w-4 h-4" />
    return <Layers className="w-4 h-4" />
  }

  const currentQuestion = getCurrentQuestion()
  const currentSection = sections[currentSectionIndex] || null

  useEffect(() => {
    updateAnsweredCount()
  }, [answers])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy-800 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-navy-800 mb-2">No Questions Found</h2>
          <p className="text-gray-600">This assessment has no questions configured.</p>
        </div>
      </div>
    )
  }

  const totalQuestionsCount = questions.length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-bold text-navy-800">{assessment?.template_name}</h1>
                <p className="text-xs text-gray-500">{assessment?.job_role}</p>
              </div>
              <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
                {sections.map((section, idx) => (
                  <span key={section.id} className={`px-2 py-1 rounded ${
                    idx === currentSectionIndex ? 'bg-accent-100 text-accent-700 font-medium' : 'bg-gray-100'
                  }`}>
                    {section.type === 'CODING' ? 'Coding' : 'MCQ'} {idx + 1}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={toggleCamera}
                  className={`p-1.5 rounded-lg transition-colors ${isCameraOn ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                  title={isCameraOn ? 'Camera On' : 'Camera Off'}
                >
                  {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleMicrophone}
                  className={`p-1.5 rounded-lg transition-colors ${isMicOn ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                  title={isMicOn ? 'Mic On' : 'Mic Off'}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <div className={`px-2 py-1 rounded-full text-xs ${isFullscreen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {isFullscreen ? 'Fullscreen' : 'Exit Fullscreen'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-500">Proctoring:</span>
                  <span className={`font-medium ${isStreaming ? 'text-green-600' : 'text-red-600'}`}>
                    {isStreaming ? 'Live' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-500">Recording:</span>
                  <span className={`font-medium ${mediaRecorderReady ? 'text-green-600' : 'text-red-600'}`}>
                    {mediaRecorderReady ? 'On' : 'Off'}
                  </span>
                </div>
                <Timer durationMinutes={assessment?.duration_minutes || 60} onTimeUp={() => handleSubmitAssessment(true)} />
                <Button variant="danger" size="sm" onClick={() => setShowSubmitModal(true)}>
                  Submit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${saving ? 'text-yellow-600' : saveError ? 'text-red-600' : 'text-green-600'}`}>
                    {saving ? 'Saving...' : saveError ? 'Save failed' : 'Saved'}
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Answered:</span>
                  <span className="font-medium">{answeredCount}/{totalQuestionsCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                {getSectionIcon(currentSection?.type)}
                <span className="font-medium">Section {currentSectionIndex + 1}:</span>
                <span>{getSectionTypeLabel(currentSection?.type)}</span>
                <span className="text-xs text-blue-500">
                  ({currentQuestionIndex + 1} of {currentSection?.questions?.length || 0} questions)
                </span>
              </div>
            </div>

            <QuestionCard
              question={currentQuestion}
              answer={answers[currentQuestion.id] || null}
              onChange={(answerData) => handleAnswerChange(currentQuestion.id, answerData)}
            />

            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                onClick={goToPreviousQuestion}
                disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSaveAnswer(currentQuestion.id, answers[currentQuestion.id] || {})}
                >
                  <Save className="w-4 h-4 mr-1" /> Save
                </Button>
                {currentSectionIndex === sections.length - 1 && currentQuestionIndex === (currentSection?.questions?.length || 0) - 1 ? (
                  <Button variant="primary" onClick={() => setShowSubmitModal(true)}>
                    Submit Assessment
                  </Button>
                ) : (
                  <Button variant="primary" onClick={goToNextQuestion}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-navy-800">Question Palette</h4>
                <span className="text-xs text-gray-500">{answeredCount}/{totalQuestionsCount}</span>
              </div>
              <div className="space-y-2">
                {sections.map((section, sectionIdx) => (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      {getSectionIcon(section.type)}
                      <span className="font-medium">Section {sectionIdx + 1}</span>
                      <span className="text-gray-400">({section.type})</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {section.questions.map((q, localIdx) => {
                        const status = getQuestionStatus(q, sectionIdx, localIdx)
                        const globalIdx = getGlobalQuestionIndex(sectionIdx, localIdx)
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              setCurrentSectionIndex(sectionIdx)
                              setCurrentQuestionIndex(localIdx)
                            }}
                            className={`relative w-8 h-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                              status === 'current'
                                ? 'bg-accent-500 text-white border-2 border-accent-600 shadow-sm'
                                : status === 'answered'
                                ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            {globalIdx + 1}
                            {status === 'answered' && (
                              <CheckCircle className="absolute -top-1 -right-1 w-3 h-3 text-green-600" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-accent-500"></div>
                  <span className="text-gray-500">Current</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
                  <span className="text-gray-500">Answered</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></div>
                  <span className="text-gray-500">Unanswered</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <h4 className="text-sm font-semibold text-navy-800 mb-2">Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Answered</span>
                  <span className="font-medium">{answeredCount}/{totalQuestionsCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Sections</span>
                  <span className="font-medium">{sections.length}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${isStreaming ? 'text-green-600' : 'text-red-600'}`}>
                    {isStreaming ? 'Monitoring Active' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="w-full flex items-center justify-between text-sm font-semibold text-navy-800"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-accent-600" />
                  Chat with Proctor
                </span>
                <span className="text-xs text-gray-400">{chatMessages.length > 0 ? `(${chatMessages.length})` : ''}</span>
              </button>

              {chatOpen && (
                <div className="mt-3">
                  <div className="max-h-32 overflow-y-auto space-y-1 mb-2 border border-gray-100 rounded-lg p-2">
                    {chatMessages.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">No messages</p>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.sender === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-xs ${
                            msg.sender === 'candidate'
                              ? 'bg-accent-500 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-700 rounded-bl-none'
                          }`}>
                            <div className="font-medium text-xs opacity-80 mb-0.5">
                              {msg.sender === 'candidate' ? 'You' : 'Proctor'}
                            </div>
                            <div>{msg.message}</div>
                            <div className={`text-[10px] mt-0.5 ${msg.sender === 'candidate' ? 'text-accent-100' : 'text-gray-400'}`}>
                              {msg.timestamp}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder={isStreaming ? "Type a message..." : "Waiting for connection..."}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:bg-gray-100"
                      disabled={!isStreaming}
                    />
                    <button
                      onClick={sendChatMessage}
                      className="px-3 py-1 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 disabled:opacity-50"
                      disabled={!isStreaming}
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <video ref={videoRef} className="hidden" playsInline muted />

      <Modal
        isOpen={showSubmitModal}
        onClose={() => !submitting && setShowSubmitModal(false)}
        title="Submit Assessment"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to submit this assessment?
          </p>
          <p className="text-sm text-gray-500">
            You have answered {answeredCount} out of {totalQuestionsCount} questions.
          </p>
          {answeredCount < totalQuestionsCount && (
            <p className="text-sm text-yellow-600">
              Warning: {totalQuestionsCount - answeredCount} question(s) unanswered.
            </p>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => handleSubmitAssessment(false)}
              isLoading={submitting}
              variant="primary"
              className="flex-1"
            >
              Submit
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSubmitModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}