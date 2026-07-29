import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, User, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CandidateChat({ wsRef, sessionId, candidateName }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)

  useEffect(() => {
    if (wsRef.current) {
      const originalOnMessage = wsRef.current.onmessage
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'chat_message') {
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: 'manager',
              message: data.message,
              timestamp: new Date().toLocaleTimeString()
            }])
            toast.info('New message from proctor')
          }
          
          if (data.type === 'chat_reply') {
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: 'manager',
              message: data.message,
              timestamp: new Date().toLocaleTimeString()
            }])
            setIsTyping(false)
          }
          
          if (data.type === 'chat_typing') {
            setIsTyping(true)
            setTimeout(() => setIsTyping(false), 3000)
          }
        } catch (e) {
          console.error('Chat message error:', e)
        }
        
        if (originalOnMessage) {
          originalOnMessage(event)
        }
      }
    }
  }, [wsRef])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMessage = () => {
    if (!inputMessage.trim()) return
    
    const message = inputMessage.trim()
    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'candidate',
      message: message,
      timestamp: new Date().toLocaleTimeString()
    }])
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        session_id: sessionId,
        message: message
      }))
    }
    
    setInputMessage('')
  }

  const handleTyping = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && inputMessage.length > 3) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_typing',
        session_id: sessionId
      }))
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-accent-500 hover:bg-accent-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 flex items-center gap-2"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="text-sm font-medium hidden sm:inline">Need Help?</span>
        </button>
      ) : (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-80 sm:w-96 flex flex-col max-h-[500px]">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-navy-800 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <h3 className="font-semibold">Proctor Support</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[300px]" ref={chatContainerRef}>
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                <p>Need help during the exam?</p>
                <p className="text-xs mt-1">Send a message to the proctor</p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'candidate' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.sender === 'candidate'
                      ? 'bg-accent-500 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs opacity-75">
                      {msg.sender === 'candidate' ? 'You' : 'Proctor'}
                    </span>
                    <span className="text-xs opacity-50">{msg.timestamp}</span>
                  </div>
                  <p className="text-sm">{msg.message}</p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-lg rounded-bl-none">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value)
                  handleTyping()
                }}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 text-sm"
                maxLength={500}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim()}
                className="p-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {inputMessage.length}/500 characters
            </p>
          </div>
        </div>
      )}
    </div>
  )
}