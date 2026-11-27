import { useState } from 'react'

interface StarsProps {
  value: number
  onChange?: (v: number) => void
  size?: 'sm' | 'md'
}

export function Stars({ value, onChange, size = 'md' }: StarsProps) {
  const [hover, setHover] = useState(0)
  const interactive = typeof onChange === 'function'
  const shown = hover || value

  return (
    <span className={`stars stars-${size}`} role="img" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`star ${i <= shown ? 'star-on' : 'star-off'}`}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onChange?.(i)}
          role={interactive ? 'button' : undefined}
          aria-hidden={interactive ? undefined : true}
        >
          ★
        </span>
      ))}
    </span>
  )
}

interface ReviewItemProps {
  rating: number
  comment: string
  createdAt: string
  authorName?: string
}

export function ReviewItem({ rating, comment, createdAt, authorName }: ReviewItemProps) {
  return (
    <div className="review-item">
      <div className="review-head">
        <Stars value={rating} size="sm" />
        {authorName && <span className="review-author">{authorName}</span>}
        <span className="review-date">{new Date(createdAt).toLocaleDateString('es-CU')}</span>
      </div>
      {comment && <p className="review-comment">{comment}</p>}
    </div>
  )
}
