import client from './client'

export async function getTemplates(params) {
  const response = await client.get('/admin/templates', { params })
  return response.data
}

export async function getTemplate(id) {
  const response = await client.get(`/admin/templates/${id}`)
  return response.data
}

export async function createTemplate(data) {
  const response = await client.post('/admin/templates', data)
  return response.data
}

export async function updateTemplate(id, data) {
  const response = await client.put(`/admin/templates/${id}`, data)
  return response.data
}

export async function deleteTemplate(id) {
  const response = await client.delete(`/admin/templates/${id}`)
  return response.data
}

export async function getTemplateHistory(id) {
  const response = await client.get(`/admin/templates/${id}/history`)
  return response.data
}

export async function getTemplateUsage(id) {
  try {
    const response = await client.get(`/admin/templates/${id}/usage`)
    return response.data
  } catch (error) {
    return { session_count: 0, can_delete: true }
  }
}