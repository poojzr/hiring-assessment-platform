import client from './client'

export const getCandidates = async (params = {}) => {
  const response = await client.get('/candidates', { params })
  return response.data
}

export const getCandidate = async (id) => {
  const response = await client.get(`/candidates/${id}`)
  return response.data
}

export const createCandidate = async (data) => {
  const response = await client.post('/candidates', data)
  return response.data
}

export const updateCandidate = async (id, data) => {
  const response = await client.put(`/candidates/${id}`, data)
  return response.data
}

export const deleteCandidate = async (id) => {
  const response = await client.delete(`/candidates/${id}`)
  return response.data
}

export const checkATSScore = async (id, atsScore) => {
  const response = await client.post(`/candidates/${id}/ats-score`, { ats_score: atsScore })
  return response.data
}

export const resendAssessmentEmail = async (id) => {
  const response = await client.post(`/candidates/${id}/resend-email`)
  return response.data
}