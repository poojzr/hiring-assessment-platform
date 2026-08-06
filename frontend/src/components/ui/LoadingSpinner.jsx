export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-12 h-12 border-4 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
}