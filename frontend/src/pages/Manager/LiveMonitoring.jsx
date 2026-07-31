import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Video, VideoOff, Users, AlertTriangle, 
  RefreshCw, Eye, X, Send, Power, MessageSquare,
  User, Mail, Calendar
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/client'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { useWebSocket } from '../../hooks/useWebSocket'

export default function LiveMonitoring() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [violations, setViolations] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const videoRef = useRef(null)
  const chatEndRef = useRef(null)
  const frameCountRef = useRef(0)
  const mountedRef = useRef(true)
  const warningToastRef = useRef(null)
  const terminateToastRef = useRef(null)

  const token = localStorage.getItem('access_token')
  const wsBase = import.meta.env.VITE_WS_URL 
  const wsUrl = `${wsBase}/api/proctor/manager/live?token=${token}`
    
  const { isConnected, send, lastMessage, reconnect, error, close } = useWebSocket(wsUrl, {
    onOpen: () => {
      console.log('Manager WebSocket connected')
      toast.success('Connected to live monitoring')
      if (selectedSession && mountedRef.current) {
        subscribeToSession(selectedSession.session_id)
      }
    },
    onClose: () => {
      console.log('Manager WebSocket disconnected')
      toast.error('Disconnected from live monitoring')
    },
    onMessage: (data) => {
      if (!mountedRef.current) return
      console.log('Manager WebSocket message:', data)
      
      if (data.type === 'frame' && selectedSession && data.session_id === selectedSession.session_id) {
        frameCountRef.current += 1
        if (videoRef.current) {
          videoRef.current.src = 'data:image/jpeg;base64,' + data.data
        }
      }
      
      if (data.type === 'violation') {
        if (data.session_id === selectedSession?.session_id) {
          setViolations(prev => [...prev, {
            type: data.event || data.violation_type || 'UNKNOWN',
            severity: data.severity || 'medium',
            timestamp: data.timestamp || new Date().toISOString()
          }])
        }
      }

      if (data.type === 'presence') {
        setSessions(data.sessions || [])
      }

      if (data.type === 'warning_sent') {
        if (warningToastRef.current) {
          toast.dismiss(warningToastRef.current)
          warningToastRef.current = null
        }
        toast.success('Warning sent to candidate')
        setChatMessages(prev => [...prev, {
          sender: 'system',
          message: 'Warning sent: ' + data.message,
          timestamp: new Date().toLocaleTimeString()
        }])
      }

      if (data.type === 'candidate_offline') {
        toast.error('Candidate disconnected')
        if (selectedSession?.session_id === data.session_id) {
          setSelectedSession(null)
          setViolations([])
          if (videoRef.current) {
            videoRef.current.src = ''
          }
        }
        fetchActiveSessions()
      }

      if (data.type === 'terminated') {
        if (terminateToastRef.current) {
          toast.dismiss(terminateToastRef.current)
          terminateToastRef.current = null
        }
        toast.success('Session terminated successfully')
        if (selectedSession?.session_id === data.session_id) {
          setSelectedSession(null)
          setViolations([])
          if (videoRef.current) {
            videoRef.current.src = ''
          }
        }
        fetchActiveSessions()
      }

      if (data.type === 'chat') {
        const sender = data.sender || 'candidate'
        setChatMessages(prev => [...prev, {
          sender: sender,
          message: data.message,
          timestamp: data.timestamp || new Date().toLocaleTimeString()
        }])
        if (sender === 'candidate') {
          toast('Candidate: ' + data.message, { duration: 5000 })
        }
      }

      if (data.type === 'chat_sent') {
        setChatMessages(prev => [...prev, {
          sender: 'system',
          message: 'Message sent: ' + data.message,
          timestamp: new Date().toLocaleTimeString()
        }])
      }

      if (data.type === 'subscribed') {
        toast.success('Subscribed to session')
      }

      if (data.type === 'error') {
        toast.error('Error: ' + data.message)
      }
    },
    autoReconnect: true,
    maxReconnectAttempts: 2,
    reconnectDelay: 5000
  })

  useEffect(() => {
    mountedRef.current = true
    fetchActiveSessions()

    return () => {
      mountedRef.current = false
      close()
    }
  }, [close])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  const fetchActiveSessions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiClient.get('/manager/sessions?status=in_progress&limit=100')
      console.log('Active sessions:', response.data)
      setSessions(response.data.items || [])
    } catch (error) {
      console.error('Failed to fetch active sessions:', error)
      toast.error('Failed to load active sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadChatHistory = useCallback(async (sessionId) => {
    try {
      const response = await apiClient.get(`/proctor/sessions/${sessionId}/chat`)
      const history = (response.data || []).map((m) => ({
        sender: m.sender,
        message: m.message,
        timestamp: new Date(m.timestamp).toLocaleTimeString()
      }))
      setChatMessages(history)
    } catch (error) {
      console.error('Failed to load chat history:', error)
      setChatMessages([])
    }
  }, [])

  const subscribeToSession = useCallback((sessionId) => {
    if (isConnected && sessionId && mountedRef.current) {
      const subscribeMsg = {
        action: 'subscribe',
        session_id: sessionId
      }
      console.log('Subscribing to session:', subscribeMsg)
      send(subscribeMsg)
    }
  }, [isConnected, send])

  const selectSession = useCallback((session) => {
    if (selectedSession?.session_id === session.session_id) {
      return
    }
    
    setSelectedSession(session)
    setViolations([])
    loadChatHistory(session.session_id)
    frameCountRef.current = 0
    
    if (videoRef.current) {
      videoRef.current.src = ''
    }
    
    if (isConnected && mountedRef.current) {
      subscribeToSession(session.session_id)
    } else {
      toast.error('WebSocket not connected. Trying to reconnect...')
      reconnect()
    }
  }, [selectedSession, isConnected, subscribeToSession, reconnect, loadChatHistory])

  const deselectSession = useCallback(() => {
    if (selectedSession && isConnected && mountedRef.current) {
      const unsubscribeMsg = {
        action: 'unsubscribe',
        session_id: selectedSession.session_id
      }
      send(unsubscribeMsg)
    }
    setSelectedSession(null)
    setViolations([])
    setChatMessages([])
    if (videoRef.current) {
      videoRef.current.src = ''
    }
  }, [selectedSession, isConnected, send])

  const sendWarning = useCallback(() => {
    if (!selectedSession) {
      toast.error('No session selected')
      return
    }
    const message = prompt('Enter warning message for the candidate:')
    if (message && message.trim() && mountedRef.current) {
      if (isConnected) {
        const payload = {
          action: 'warn',
          session_id: selectedSession.session_id,
          message: message.trim()
        }
        send(payload)
        if (warningToastRef.current) {
          toast.dismiss(warningToastRef.current)
          warningToastRef.current = null
        }
        warningToastRef.current = toast.loading('Sending warning...')
      } else {
        toast.error('WebSocket not connected')
      }
    }
  }, [selectedSession, isConnected, send])

  const terminateSession = useCallback(() => {
    if (!selectedSession) {
      toast.error('No session selected')
      return
    }
    if (!confirm('Are you sure you want to terminate session for ' + selectedSession.candidate_name + '?')) return
    const reason = prompt('Enter termination reason:')
    if (reason && reason.trim() && mountedRef.current) {
      if (isConnected) {
        const payload = {
          action: 'terminate',
          session_id: selectedSession.session_id,
          reason: reason.trim()
        }
        send(payload)
        if (terminateToastRef.current) {
          toast.dismiss(terminateToastRef.current)
          terminateToastRef.current = null
        }
        terminateToastRef.current = toast.loading('Terminating session...')
      } else {
        toast.error('WebSocket not connected')
      }
    }
  }, [selectedSession, isConnected, send])

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim()) return
    if (!selectedSession) {
      toast.error('No session selected')
      return
    }
    if (!isConnected) {
      toast.error('WebSocket not connected')
      return
    }
    if (!mountedRef.current) return
    
    const payload = {
      action: 'chat',
      session_id: selectedSession.session_id,
      message: chatInput.trim(),
      sender: 'proctor'
    }
    send(payload)
    
    setChatMessages(prev => [...prev, {
      sender: 'proctor',
      message: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString()
    }])
    setChatInput('')
  }, [chatInput, selectedSession, isConnected, send])

  const getSeverityColor = (severity) => {
    const map = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700'
    }
    return map[severity] || 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy-800">Live Monitoring</h1>
        <div className="flex items-center gap-3">
          <span className={'px-3 py-1 rounded-full text-sm ' + (isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <Button variant="outline" onClick={fetchActiveSessions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {!isConnected && (
            <Button variant="primary" onClick={reconnect}>
              Reconnect
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-navy-800 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              Active Sessions ({sessions.length})
            </h3>
            <div className="max-h-[600px] overflow-y-auto space-y-2">
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No active sessions</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.session_id}
                    onClick={() => selectSession(session)}
                    className={'p-3 rounded-lg cursor-pointer transition-colors ' + (
                      selectedSession?.session_id === session.session_id
                        ? 'bg-accent-50 border-2 border-accent-500'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-navy-800">{session.candidate_name}</p>
                        <p className="text-xs text-gray-500">{session.candidate_email}</p>
                        <p className="text-xs text-gray-400">{session.job_role}</p>
                      </div>
                      <Badge variant="primary">Live</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>Integrity: {session.integrity_score || 100}%</span>
                      <span>Started: {session.started_at ? new Date(session.started_at).toLocaleTimeString() : '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedSession ? (
            <div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-navy-800 flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      {selectedSession.candidate_name}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {selectedSession.candidate_email}
                      <span className="text-gray-300">|</span>
                      {selectedSession.job_role}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span>Integrity Score: <span className="font-semibold">{selectedSession.integrity_score || 100}%</span></span>
                      <span>Frames: {frameCountRef.current}</span>
                      <span>Violations: {violations.length}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="warning" onClick={sendWarning}>
                      <Send className="w-4 h-4 mr-1" />
                      Send Warning
                    </Button>
                    <Button size="sm" variant="danger" onClick={terminateSession}>
                      <Power className="w-4 h-4 mr-1" />
                      Terminate
                    </Button>
                    <Button size="sm" variant="outline" onClick={deselectSession}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div className="bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center relative">
                    {isConnected ? (
                      <>
                        <img ref={videoRef} className="w-full h-full object-contain" alt="Live candidate feed" />
                        <div className="absolute top-2 left-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">LIVE</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-gray-500">
                        <VideoOff className="w-16 h-16 mx-auto mb-4" />
                        <p>Connecting to stream...</p>
                        <button onClick={reconnect} className="mt-2 text-sm text-primary-400 hover:text-primary-300">
                          Reconnect
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 max-h-[200px] overflow-y-auto">
                    <h4 className="font-semibold text-navy-800 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      Violations Log ({violations.length})
                    </h4>
                    {violations.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No violations detected</p>
                    ) : (
                      <div className="space-y-2">
                        {violations.slice(-5).reverse().map((violation, index) => (
                          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                            <div>
                              <p className="text-sm font-medium">{violation.type.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-gray-500">{violation.timestamp}</p>
                            </div>
                            <span className={'px-2 py-1 rounded-full text-xs font-medium ' + getSeverityColor(violation.severity)}>
                              {violation.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-navy-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-accent-600" />
                        Chat with Candidate
                      </h4>
                      <button
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {isChatOpen ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {isChatOpen && (
                      <>
                        <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                          {chatMessages.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-2">No messages</p>
                          ) : (
                            chatMessages.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.sender === 'proctor' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] px-3 py-1.5 rounded-lg text-sm ${
                                  msg.sender === 'proctor'
                                    ? 'bg-accent-500 text-white rounded-br-none'
                                    : msg.sender === 'system'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-700 rounded-bl-none'
                                }`}>
                                  <div className="font-medium text-xs opacity-80 mb-0.5">
                                    {msg.sender === 'proctor' ? 'You' : msg.sender === 'system' ? 'System' : 'Candidate'}
                                  </div>
                                  <div>{msg.message}</div>
                                  <div className={`text-[10px] mt-0.5 ${msg.sender === 'proctor' ? 'text-accent-100' : 'text-gray-400'}`}>
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
                            placeholder="Type a message..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                            disabled={!selectedSession || !isConnected}
                          />
                          <button
                            onClick={sendChatMessage}
                            className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 transition-colors"
                            disabled={!selectedSession || !isConnected}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
              <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-800 mb-2">No Session Selected</h3>
              <p className="text-gray-500">Select a candidate from the list to start monitoring</p>
              {!isConnected && (
                <Button onClick={reconnect} className="mt-4">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconnect WebSocket
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}