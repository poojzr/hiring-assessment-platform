import client from './client'

export async function getSessions(params) {
  const response = await client.get('/manager/sessions', { params })
  return response.data
}

export async function createSession(data) {
  const response = await client.post('/manager/sessions', data)
  return response.data
}

export async function getSessionByToken(accessToken) {
  const response = await client.get(`/manager/sessions/by-token/${accessToken}`)
  return response.data
}

export async function resendSessionEmail(sessionId) {
  const response = await client.post(`/manager/sessions/${sessionId}/resend-email`)
  return response.data
}

export async function deleteSession(sessionId) {
  const response = await client.delete(`/manager/sessions/${sessionId}`)
  return response.data
}

export async function exportSessions(params) {
  const response = await apiClient.get('/manager/sessions/export', {
    params,
    responseType: 'blob'
  })
  return response.data
}