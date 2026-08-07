import apiClient from './client'

export const sendContactMessage = async (data) => {
  const response = await apiClient.post('/contact', data)
  return response.data
}