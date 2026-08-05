import { cn } from '../../utils/helpers'

export function Table({ children, className }) {
  return (
    <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
      <table className={cn('w-full min-w-[600px] sm:min-w-0', className)}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children, className }) {
  return (
    <thead className={cn('bg-gray-50 border-b border-gray-200', className)}>
      <tr>{children}</tr>
    </thead>
  )
}

export function TableHeader({ children, className }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 sm:px-4 sm:py-3 text-left text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap',
        className
      )}
    >
      {children}
    </th>
  )
}

export function TableBody({ children, className }) {
  return <tbody className={cn('divide-y divide-gray-200', className)}>{children}</tbody>
}

export function TableRow({ children, className, onClick }) {
  return (
    <tr
      className={cn('hover:bg-gray-50 transition-colors', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableCell({ children, className }) {
  return (
    <td className={cn('px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-gray-600', className)}>
      {children}
    </td>
  )
}

export default Table