import { cn } from '../../utils/helpers'

export function Card({ children, className, title }) {
  return (
    <div className={cn('card', className)}>
      {title && <div className="card-header">{title}</div>}
      <div className="card-body">{children}</div>
    </div>
  )
}

export function CardHeader({ children, className }) {
  return <div className={cn('card-header', className)}>{children}</div>
}

export function CardBody({ children, className }) {
  return <div className={cn('card-body', className)}>{children}</div>
}

export default Card