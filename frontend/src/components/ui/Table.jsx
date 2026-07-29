import { cn } from '../../utils/helpers'

export function Table({ children, className }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full', className)}>
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
    <th className={cn('px-4 py-3 text-left text-sm font-medium text-gray-500', className)}>
      {children}
    </th>
  )
}

export function TableBody({ children, className }) {
  return <tbody className={cn('divide-y divide-gray-200', className)}>{children}</tbody>
}

export function TableRow({ children, className, onClick }) {
  return (
    <tr className={cn('hover:bg-gray-50 transition-colors', className)} onClick={onClick}>
      {children}
    </tr>
  )
}

export function TableCell({ children, className }) {
  return <td className={cn('px-4 py-3 text-sm text-gray-600', className)}>{children}</td>
}

export default Table