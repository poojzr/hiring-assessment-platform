import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  const handleToggle = () => {
    toggleTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-navy-800 dark:text-gray-200" />
      ) : (
        <Sun className="w-4 h-4 text-navy-800 dark:text-gray-200" />
      )}
      <span className="text-sm text-navy-800 dark:text-gray-200 capitalize hidden sm:inline">
        {theme}
      </span>
    </button>
  )
}