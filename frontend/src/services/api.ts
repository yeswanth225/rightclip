/// <reference types="vite/client" />

import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.DEV ? '' : 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)
