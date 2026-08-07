import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './context/ThemeContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <Suspense fallback={
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-dark-900">
      <div className="w-12 h-12 border-4 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  }>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </Suspense>
)