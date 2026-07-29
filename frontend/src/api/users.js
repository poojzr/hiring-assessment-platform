import client from './client'

export async function getUsers(params) {
  const response = await client.get('/admin/users', { params })
  return response.data
}

export async function getUser(id) {
  const response = await client.get(`/admin/users/${id}`)
  return response.data
}

export async function createUser(data) {
  const response = await client.post('/admin/users', data)
  return response.data
}

export async function updateUser(id, data) {
  const response = await client.put(`/admin/users/${id}`, data)
  return response.data
}

export async function deleteUser(id, permanent) {
  const params = permanent ? '?permanent=true' : ''
  const response = await client.delete(`/admin/users/${id}${params}`)
  return response.data
}