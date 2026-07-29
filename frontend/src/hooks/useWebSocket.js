import { useState, useEffect, useRef, useCallback } from 'react'

export function useWebSocket(url, options = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = options.maxReconnectAttempts || 2
  const reconnectDelay = options.reconnectDelay || 5000
  const isMountedRef = useRef(true)
  const isConnectingRef = useRef(false)
  const manualCloseRef = useRef(false)
  const consecutiveFailuresRef = useRef(0)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  })

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close() } catch (e) {}
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  const connect = useCallback(() => {
    if (!isMountedRef.current || isConnectingRef.current || manualCloseRef.current) return
    if (consecutiveFailuresRef.current >= 3) {
      setError('Connection failed after multiple attempts')
      return
    }
    try {
      isConnectingRef.current = true
      wsRef.current = new WebSocket(url)

      wsRef.current.onopen = () => {
        if (!isMountedRef.current) return
        setIsConnected(true)
        reconnectAttempts.current = 0
        isConnectingRef.current = false
        consecutiveFailuresRef.current = 0
        optionsRef.current.onOpen?.()
      }
      wsRef.current.onmessage = (event) => {
        if (!isMountedRef.current) return
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
          optionsRef.current.onMessage?.(data)
        } catch {
          setLastMessage(event.data)
          optionsRef.current.onMessage?.(event.data)
        }
      }
      wsRef.current.onerror = (event) => {
        if (!isMountedRef.current) return
        setError('WebSocket error')
        isConnectingRef.current = false
        consecutiveFailuresRef.current += 1
        optionsRef.current.onError?.(event)
      }
      wsRef.current.onclose = (event) => {
        if (!isMountedRef.current) return
        setIsConnected(false)
        isConnectingRef.current = false
        optionsRef.current.onClose?.(event)
        if (manualCloseRef.current) return

        if (event.code === 1005 || event.code === 1006) {
          consecutiveFailuresRef.current += 1
          if (consecutiveFailuresRef.current >= 3) {
            setError('Connection rejected by server')
            return
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !manualCloseRef.current) connect()
          }, 10000)
          return
        }
        if (reconnectAttempts.current < maxReconnectAttempts && optionsRef.current.autoReconnect !== false) {
          reconnectAttempts.current += 1
          const delay = reconnectDelay * reconnectAttempts.current
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && !manualCloseRef.current) connect()
          }, delay)
        }
      }
    } catch (err) {
      setError(err.message)
      isConnectingRef.current = false
      consecutiveFailuresRef.current += 1
      optionsRef.current.onError?.(err)
    }
  }, [url])

  useEffect(() => {
    isMountedRef.current = true
    manualCloseRef.current = false
    reconnectAttempts.current = 0
    consecutiveFailuresRef.current = 0
    connect()
    return () => {
      isMountedRef.current = false
      manualCloseRef.current = true
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      closeWebSocket()
    }
  }, [url])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    }
    return false
  }, [])

  const close = useCallback(() => {
    manualCloseRef.current = true
    isConnectingRef.current = false
    consecutiveFailuresRef.current = 0
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    closeWebSocket()
  }, [closeWebSocket])

  const reconnect = useCallback(() => {
    manualCloseRef.current = false
    reconnectAttempts.current = 0
    consecutiveFailuresRef.current = 0
    closeWebSocket()
    setTimeout(() => { if (isMountedRef.current && !manualCloseRef.current) connect() }, 100)
  }, [connect, closeWebSocket])

  return { isConnected, lastMessage, error, send, close, reconnect, readyState: wsRef.current?.readyState }
}