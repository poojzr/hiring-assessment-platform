import client from './client'

export const getRecordings = async (sessionId) => {
  if (!sessionId) {
    throw new Error('Session ID is required')
  }
  const response = await client.get(`/recordings/sessions/${sessionId}`)
  return response.data
}

export const uploadRecordingChunk = async (sessionId, file, chunkIndex, duration, quality) => {
  if (!sessionId) {
    throw new Error('Session ID is required')
  }
  const formData = new FormData()
  formData.append('chunk', file)
  formData.append('chunk_index', String(chunkIndex || 0))
  formData.append('duration', String(duration || 0))
  formData.append('quality', quality || 'medium')
  
  const response = await client.post(`/recordings/sessions/${sessionId}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const getRecording = async (recordingId) => {
  const response = await client.get(`/recordings/${recordingId}`)
  return response.data
}

export const deleteRecording = async (recordingId) => {
  const response = await client.delete(`/recordings/${recordingId}`)
  return response.data
}

export const deleteAllRecordings = async (sessionId) => {
  if (!sessionId) {
    throw new Error('Session ID is required')
  }
  const response = await client.delete(`/recordings/sessions/${sessionId}`)
  return response.data
}

export const getRecordingStream = (recordingId) => {
  if (!recordingId) {
    throw new Error('Recording ID is required')
  }
  const token = localStorage.getItem('access_token')
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  return `${API_BASE_URL}/api/recordings/${recordingId}/stream?token=${token}`
}