import {
  Armchair,
  Baby,
  Briefcase,
  Car,
  Dumbbell,
  Guitar,
  Hammer,
  Headphones,
  House,
  LayoutGrid,
  Laptop,
  MonitorSmartphone,
  Package,
  PawPrint,
  Plug,
  Shirt,
  Smartphone,
  Sprout,
  Sun,
  Volleyball,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface CategoryStyle {
  Icon: LucideIcon
  /** fondo pastel */
  bg: string
  /** borde */
  border: string
  /** trazo del icono */
  ink: string
}

const P = {
  mint: { bg: '#E8F0EC', border: '#CFE0D7', ink: '#3E6B5A' },
  peach: { bg: '#F8E6DE', border: '#EFCDBE', ink: '#A9502F' },
  sage: { bg: '#E8EDDF', border: '#D3DCC4', ink: '#5A6B3E' },
  sand: { bg: '#F7EEDB', border: '#EADBB9', ink: '#8C6A2E' },
  rose: { bg: '#F5E4E4', border: '#E8CACA', ink: '#9C4A55' },
  sky: { bg: '#E3ECF2', border: '#C9D9E5', ink: '#3E6283' },
  stone: { bg: '#EEEAE2', border: '#DDD6C9', ink: '#6B5E4A' },
  lilac: { bg: '#ECE6F1', border: '#D9CEE4', ink: '#6A4F86' },
}

const MAP: Record<string, CategoryStyle> = {
  tecnologia: { Icon: MonitorSmartphone, ...P.mint },
  vehiculos: { Icon: Car, ...P.peach },
  inmuebles: { Icon: House, ...P.sage },
  telefonia: { Icon: Smartphone, ...P.mint },
  electronica: { Icon: Headphones, ...P.sky },
  computacion: { Icon: Laptop, ...P.mint },
  electrodomesticos: { Icon: Plug, ...P.stone },
  energia: { Icon: Sun, ...P.sand },
  hogar: { Icon: Armchair, ...P.sand },
  moda: { Icon: Shirt, ...P.rose },
  deportes: { Icon: Volleyball, ...P.sky },
  musica: { Icon: Guitar, ...P.lilac },
  mascotas: { Icon: PawPrint, ...P.peach },
  ninos: { Icon: Baby, ...P.rose },
  herramientas: { Icon: Hammer, ...P.stone },
  agro: { Icon: Sprout, ...P.sage },
  servicios: { Icon: Wrench, ...P.stone },
  empleos: { Icon: Briefcase, ...P.sky },
  otros: { Icon: Package, ...P.stone },
  gimnasio: { Icon: Dumbbell, ...P.sky },
}

export function categoryStyle(slug: string): CategoryStyle {
  return MAP[slug] ?? { Icon: LayoutGrid, ...P.stone }
}

/** Accesos destacados de la portada (como en el diseño). */
export const FEATURED_CATEGORIES: { slug: string; label: string; to: string }[] = [
  { slug: 'tecnologia', label: 'Tecnología', to: '/categoria/tecnologia' },
  { slug: 'vehiculos', label: 'Vehículos', to: '/categoria/vehiculos' },
  { slug: 'inmuebles', label: 'Inmuebles', to: '/categoria/inmuebles' },
  { slug: 'hogar', label: 'Hogar', to: '/categoria/hogar' },
  { slug: 'moda', label: 'Moda', to: '/categoria/moda' },
  { slug: 'deportes', label: 'Deportes', to: '/categoria/deportes' },
  { slug: 'servicios', label: 'Servicios', to: '/categoria/servicios' },
]
