import client from './client'

export const getAssessment = async (accessToken) => {
  const response = await client.get(`/assessments/${accessToken}`)
  return response.data
}

export const sendOTP = async (accessToken, email) => {
  const response = await client.post(`/assessments/${accessToken}/send-otp`, { email })
  return response.data
}

export const verifyOTP = async (accessToken, email, otpCode) => {
  const response = await client.post(`/assessments/${accessToken}/verify-otp`, { 
    email, 
    otp_code: otpCode 
  })
  return response.data
}

export const capturePhoto = async (accessToken, photoData) => {
  const response = await client.post(`/assessments/${accessToken}/capture-photo`, { 
    photo: photoData 
  })
  return response.data
}

export const getVerificationStatus = async (accessToken) => {
  const response = await client.get(`/assessments/${accessToken}/verify-status`)
  return response.data
}

export const startAssessment = async (accessToken) => {
  const response = await client.post(`/assessments/${accessToken}/start`)
  return response.data
}

export const submitAssessment = async (accessToken, answers) => {
  const response = await client.post(`/assessments/${accessToken}/submit`, { answers })
  return response.data
}

export const saveAnswer = async (accessToken, questionId, answerData) => {
  const response = await client.post(`/assessments/${accessToken}/answer`, {
    question_id: questionId,
    answer_data: answerData
  })
  return response.data
}

export const runCode = async (accessToken, questionId, code, language) => {
  const response = await client.post(`/assessments/${accessToken}/run-code`, {
    question_id: questionId,
    code,
    language
  })
  return response.data
}

export const getAssessmentStatus = async (accessToken) => {
  const response = await client.get(`/assessments/${accessToken}/status`)
  return response.data
}

export const uploadRecordingChunk = async (accessToken, chunk, chunkIndex) => {
  const formData = new FormData()
  formData.append('chunk', chunk)
  formData.append('chunk_index', chunkIndex)
  const response = await client.post(`/assessments/${accessToken}/upload-recording`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}