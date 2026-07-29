import client from './client'

export async function getThresholds() {
  const response = await client.get('/admin/thresholds')
  return response.data
}

export async function getThreshold(id) {
  const response = await client.get(`/admin/thresholds/${id}`)
  return response.data
}

export async function createThreshold(data) {
  const response = await client.post('/admin/thresholds', data)
  return response.data
}

export async function updateThreshold(id, data) {
  const response = await client.put(`/admin/thresholds/${id}`, data)
  return response.data
}

export async function deleteThreshold(id) {
  const response = await client.delete(`/admin/thresholds/${id}`)
  return response.data
}