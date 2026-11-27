export interface Category {
  id: number
  slug: string
  name: string
  icon: string
}

export interface Profile {
  id: string
  username: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
}

export interface Listing {
  id: string
  seller_id: string
  category_id: number
  title: string
  description: string
  price_usd: number | string
  negotiable: boolean
  condition: string
  province: string
  city: string | null
  images: string[]
  phone: string | null
  status: string
  views: number
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  author_id: string
  seller_id: string
  rating: number
  comment: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  listing_id: string
  sender_id: string
  receiver_id: string
  body: string
  read_at: string | null
  created_at: string
}

export interface ListingWithRelations extends Listing {
  category: Category | null
  seller: Profile | null
}

export const CONDITIONS: Record<string, string> = {
  nuevo: 'Nuevo',
  usado: 'Usado',
  como_nuevo: 'Como nuevo',
  defectuoso: 'Con defectos',
}

export function conditionLabel(condition: string): string {
  return CONDITIONS[condition] ?? condition
}
