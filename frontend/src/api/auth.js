import client from './client'

export async function login(email, password) {
  const response = await client.post('/auth/login', { email, password })
  return response.data
}

export async function logout(refreshToken) {
  const response = await client.post('/auth/logout', { refresh_token: refreshToken })
  return response.data
}

export async function getCurrentUser() {
  const response = await client.get('/auth/me')
  return response.data
}

export async function refreshToken(refreshToken) {
  const response = await client.post('/auth/refresh', { refresh_token: refreshToken })
  return response.data
}

export async function forgotPassword(email) {
  const response = await client.post('/auth/forgot-password', { email })
  return response.data
}

export async function resetPassword(token, newPassword, confirmPassword) {
  const response = await client.post('/auth/reset-password', {
    token,
    new_password: newPassword,
    confirm_password: confirmPassword
  })
  return response.data
}

export async function sendOTP(email) {
  const response = await client.post('/auth/send-otp', { email })
  return response.data
}

export async function verifyOTP(email, otpCode) {
  const response = await client.post('/auth/verify-otp', { email, otp_code: otpCode })
  return response.data
}

export async function changePassword(currentPassword, newPassword) {
  const response = await client.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword
  })
  return response.data
}