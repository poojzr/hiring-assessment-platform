import client from './client'

export const getManagerStats = async () => {
  const response = await client.get('/manager/analytics/overview')
  return response.data
}

export const getAnalyticsQuestions = async (params = {}) => {
  const response = await client.get('/manager/analytics/questions', { params })
  return response.data
}

export const getAnalyticsViolations = async (sessionId = null) => {
  const params = sessionId ? { session_id: sessionId } : {}
  const response = await client.get('/manager/analytics/violations', { params })
  return response.data
}

export const getSessions = async (params = {}) => {
  const response = await client.get('/manager/sessions', { params })
  return response.data
}

export const getCandidateReport = async (candidateId) => {
  const response = await client.get(`/manager/candidates/${candidateId}/report`)
  return response.data
}

export const getEligibleShortlist = async (params = {}) => {
  const response = await client.get('/manager/candidates/eligible-shortlist', { params })
  return response.data
}

export const overrideEligibility = async (sessionId, data) => {
  const response = await client.post(`/manager/sessions/${sessionId}/override`, data)
  return response.data
}

export const exportCandidates = async (params) => {
  const response = await client.get('/manager/candidates/export', { 
    params,
    responseType: 'blob'
  })
  return response
}

export const exportCandidateReport = async (candidateId, format = 'json') => {
  const response = await client.get(`/manager/candidates/${candidateId}/export`, {
    params: { format },
    responseType: 'blob'
  })
  return response
}