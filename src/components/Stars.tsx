import type { Review } from '../lib/types'

export default function Stars({
  value,
  size = 'md',
  onChange,
}: {
  value: number
  size?: 'sm' | 'md'
  onChange?: (v: number) => void
}) {
  return (
    <span className={`stars stars-${size}`} aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= value ? 'star-on' : ''}`}
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} estrellas`}
        >
          ★
        </button>
      ))}
    </span>
  )
}

export function ReviewItem({ review }: { review: Review }) {
  return (
    <div className="review-item">
      <div className="review-head">
        <Stars value={review.rating} size="sm" />
        <span className="review-date">{new Date(review.created_at).toLocaleDateString('es-CU')}</span>
      </div>
      <p className="review-text">{review.comment}</p>
    </div>
  )
}
