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
  price_usd: number
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

export interface Favorite {
  user_id: string
  listing_id: string
  created_at: string
}

export type ListingStatus = 'active' | 'sold' | 'reserved'

export type SortKey = 'recientes' | 'mas-vistos' | 'precio-asc' | 'precio-desc'

export interface SellerSummary {
  id: string
  username: string | null
  phone: string | null
  avatar_url: string | null
  listing_count: number
  avg_rating: number | null
}
