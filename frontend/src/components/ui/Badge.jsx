import { cva } from 'class-variance-authority'
import { cn } from '../../utils/helpers'

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
  {
    variants: {
      variant: {
        primary: 'bg-blue-100 text-blue-700',
        success: 'bg-green-100 text-green-700',
        warning: 'bg-yellow-100 text-yellow-700',
        danger: 'bg-red-100 text-red-700',
        admin: 'bg-red-100 text-red-700',
        manager: 'bg-blue-100 text-blue-700',
        candidate: 'bg-gray-100 text-gray-700',
        active: 'bg-green-100 text-green-700',
        inactive: 'bg-gray-100 text-gray-500',
        default: 'bg-gray-100 text-gray-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export function Badge({ children, variant, className }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  )
}

export default Badge