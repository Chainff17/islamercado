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
  currency: string
  negotiable: boolean
  condition: string
  province: string
  city: string | null
  images: string[]
  phone: string | null
  status: string
  views: number
  stock: number
  original_price: number | null
  free_shipping: boolean
  featured: boolean
  made_in_cuba: boolean
  price_period: string | null
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

export interface CartItem {
  id: string
  user_id: string
  listing_id: string
  quantity: number
  created_at: string
  listing?: Listing
}

export interface Order {
  id: string
  buyer_id: string
  seller_id: string
  status: string
  total: number
  currency: string
  payment_method: string
  delivery_province: string | null
  delivery_city: string | null
  delivery_address: string | null
  delivery_phone: string | null
  delivery_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
  buyer_name?: string
  seller_name?: string
}

export interface OrderItem {
  id: string
  order_id: string
  listing_id: string | null
  title: string
  price: number
  quantity: number
  image: string | null
  created_at: string
}

export interface Question {
  id: string
  listing_id: string
  asker_id: string
  question: string
  answer: string | null
  answered_at: string | null
  created_at: string
  asker_name?: string
}

export type ListingStatus = 'active' | 'sold' | 'reserved' | 'paused'

export type SortKey = 'recientes' | 'mas-vistos' | 'precio-asc' | 'precio-desc' | 'relevancia'

export interface SellerSummary {
  id: string
  username: string | null
  phone: string | null
  avatar_url: string | null
  listing_count: number
  avg_rating: number | null
}

export const LISTING_SELECT =
  'id, seller_id, category_id, title, description, price_usd, currency, negotiable, condition, province, city, images, phone, status, views, stock, original_price, free_shipping, featured, made_in_cuba, price_period, created_at, updated_at'
