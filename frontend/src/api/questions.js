import apiClient from './client'

export const getQuestions = async (params = {}) => {
  const response = await apiClient.get('/admin/questions', { params })
  return response.data
}

export const getQuestion = async (id) => {
  const response = await apiClient.get(`/admin/questions/${id}`)
  return response.data
}

export const getQuestionHistory = async (id) => {
  const response = await apiClient.get(`/admin/questions/${id}/history`)
  return response.data
}

export const createQuestion = async (data) => {
  const response = await apiClient.post('/admin/questions', data)
  return response.data
}

export const updateQuestion = async (id, data) => {
  const response = await apiClient.put(`/admin/questions/${id}`, data)
  return response.data
}

export const deleteQuestion = async (id) => {
  const response = await apiClient.delete(`/admin/questions/${id}`)
  return response.data
}

export const bulkImportQuestions = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post('/admin/questions/bulk-import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}