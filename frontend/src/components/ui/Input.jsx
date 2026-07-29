import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'

const Input = forwardRef(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="label">{label}</label>}
        <input
          type={type}
          className={cn('input', error && 'input-error', className)}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input