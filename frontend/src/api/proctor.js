import client from './client'

export const logViolation = async (data) => {
  const response = await client.post('/proctor/log-violation', data)
  return response.data
}

export const getProctorEvents = async (sessionId) => {
  const response = await client.get(`/proctor/sessions/${sessionId}/events`)
  return response.data
}

export const finalizeIntegrity = async (sessionId) => {
  const response = await client.post(`/proctor/sessions/${sessionId}/finalize`)
  return response.data
}

export const processFrame = async (data) => {
  const response = await client.post('/proctor/process-frame', data)
  return response.data
}

export const connectProctorWebSocket = (sessionId, token) => {
  const wsUrl = import.meta.env.VITE_WS_URL
  return new WebSocket(`${wsUrl}/api/proctor/live/${sessionId}?token=${token}`)
}

export const connectManagerWebSocket = (token) => {
  const wsUrl = import.meta.env.VITE_WS_URL
  return new WebSocket(`${wsUrl}/api/proctor/manager/live?token=${token}`)
}