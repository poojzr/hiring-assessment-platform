import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'

const Select = forwardRef(({ className, label, error, options = [], placeholder, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-navy-700 mb-1">{label}</label>}
      <select
        className={cn(
          'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 appearance-none',
          error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300',
          className
        )}
        ref={ref}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
})

Select.displayName = 'Select'

export default Select