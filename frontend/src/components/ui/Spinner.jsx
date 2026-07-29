import { cn } from '../../utils/helpers'

export function Spinner({ className, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'border-4 border-accent-500 border-t-transparent rounded-full animate-spin',
          sizeClasses[size]
        )}
      />
    </div>
  )
}

export default Spinner