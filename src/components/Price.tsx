import { formatAmount, asCurrency } from '../lib/cuba'

interface Props {
  value: number
  currency?: string | null
  period?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

/** Precio con la moneda en pequeño: «18.500 CUP», «320 USD / mes». */
export default function Price({ value, currency, period, size = 'md', className = '' }: Props) {
  return (
    <span className={`price price-${size} ${className}`}>
      <span className="price-num">{formatAmount(value)}</span>
      <span className="price-cur">{asCurrency(currency)}</span>
      {period && <span className="price-per">/ {period}</span>}
    </span>
  )
}
