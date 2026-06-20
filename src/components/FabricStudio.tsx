'use client'

/**
 * ★ Fabric Studio
 * -------------------------------------------------------------
 * Interactive product visualizer for the DFCL system.
 *
 * Flow:
 *   1. Customer/staff picks a product (chair type OR a room scene
 *      with curtains).
 *   2. Uploads a fabric image (or picks one of the presets).
 *   3. The fabric is overlaid on the product's "fabric areas"
 *      via an SVG <pattern> + image fill.
 *   4. User can adjust fabric scale, then place an order.
 *
 * The chair/room illustrations are hand-coded SVGs. Each SVG has
 * one or more <rect>/<path> elements carrying the className
 * "fabric-area". The component clones the SVG and fills those
 * elements with `url(#fabricPattern)` so the uploaded fabric
 * image appears on the right surfaces.
 *
 * Bilingual: every visible string is wrapped in t(en, bn).
 */

import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { useLanguage } from '@/lib/i18n'
import { Upload, ShoppingCart, RotateCcw, Maximize2, Wand2, Armchair as ArmchairIcon, Home as HomeIcon, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

interface ProductDef {
  id: string
  type: 'chair' | 'room'
  nameEn: string
  nameBn: string
  descEn: string
  descBn: string
  /** Renders the SVG body (without outer <svg> wrapper). All fabric
   *  surfaces MUST carry className="fabric-area". */
  render: () => React.ReactNode
  /** viewBox for the outer <svg>. */
  viewBox: string
}

interface FabricDef {
  id: string
  nameEn: string
  nameBn: string
  /** A data-URL or remote URL for the fabric image. */
  url: string
  /** True if this is a user-uploaded fabric (so we can show a Delete button). */
  uploaded?: boolean
}

// ────────────────────────────────────────────────────────────────────────
// Chair SVG illustrations
// ────────────────────────────────────────────────────────────────────────
// Style notes:
//   - All chairs face the same direction (front view, slightly 3/4).
//   - The "fabric-area" elements are the seat + backrest (and arms where
//     applicable).
//   - The base/legs/frame are drawn in a neutral dark gray so the fabric
//     pops out visually.
//   - Each SVG uses viewBox so it scales nicely in the gallery AND the
//     preview area.

const OfficeChair = () => (
  <>
    {/* 5-star base */}
    <g fill="#2c3e50">
      <ellipse cx="100" cy="232" rx="58" ry="7" />
      <polygon points="100,210 50,228 70,232 100,222 130,232 150,228" />
      <rect x="97" y="170" width="6" height="42" />
    </g>
    {/* Seat cushion (fabric) */}
    <rect x="55" y="140" width="90" height="38" rx="8" className="fabric-area" fill="#bdc3c7" stroke="#2c3e50" strokeWidth="1.5" />
    {/* Backrest (fabric) */}
    <rect x="55" y="25" width="90" height="115" rx="14" className="fabric-area" fill="#bdc3c7" stroke="#2c3e50" strokeWidth="1.5" />
    {/* Headrest accent (also fabric) */}
    <ellipse cx="100" cy="48" rx="38" ry="14" className="fabric-area" fill="#95a5a6" stroke="#2c3e50" strokeWidth="1" />
    {/* Armrests */}
    <rect x="40" y="120" width="14" height="22" rx="4" fill="#2c3e50" />
    <rect x="146" y="120" width="14" height="22" rx="4" fill="#2c3e50" />
  </>
)

const DiningChair = () => (
  <>
    {/* 4 legs */}
    <g fill="#5d4037">
      <rect x="50" y="170" width="8" height="65" rx="2" />
      <rect x="142" y="170" width="8" height="65" rx="2" />
      <rect x="55" y="170" width="6" height="65" rx="2" opacity="0.7" />
      <rect x="139" y="170" width="6" height="65" rx="2" opacity="0.7" />
      {/* Stretchers */}
      <rect x="50" y="210" width="100" height="4" />
    </g>
    {/* Seat (fabric) */}
    <rect x="42" y="140" width="116" height="36" rx="6" className="fabric-area" fill="#bdc3c7" stroke="#5d4037" strokeWidth="1.5" />
    {/* Backrest frame */}
    <rect x="42" y="20" width="6" height="125" fill="#5d4037" />
    <rect x="152" y="20" width="6" height="125" fill="#5d4037" />
    <rect x="42" y="20" width="116" height="6" fill="#5d4037" />
    {/* Backrest panel (fabric) */}
    <rect x="52" y="32" width="96" height="105" rx="4" className="fabric-area" fill="#bdc3c7" stroke="#5d4037" strokeWidth="1" />
  </>
)

const SofaChair = () => (
  <>
    {/* Base/legs */}
    <g fill="#3e2723">
      <rect x="20" y="220" width="8" height="22" />
      <rect x="232" y="220" width="8" height="22" />
      <rect x="20" y="218" width="220" height="10" rx="2" />
    </g>
    {/* Backrest frame */}
    <rect x="20" y="40" width="220" height="90" rx="10" fill="#5d4037" />
    {/* Backrest cushions (3 — fabric) */}
    <rect x="30" y="50" width="65" height="75" rx="8" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
    <rect x="100" y="50" width="65" height="75" rx="8" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
    <rect x="170" y="50" width="65" height="75" rx="8" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
    {/* Armrests (fabric-wrapped) */}
    <rect x="14" y="50" width="22" height="160" rx="10" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
    <rect x="224" y="50" width="22" height="160" rx="10" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
    {/* Seat cushions (3 — fabric) */}
    <rect x="36" y="130" width="62" height="55" rx="8" className="fabric-area" fill="#d7dbdd" stroke="#3e2723" strokeWidth="1" />
    <rect x="102" y="130" width="62" height="55" rx="8" className="fabric-area" fill="#d7dbdd" stroke="#3e2723" strokeWidth="1" />
    <rect x="168" y="130" width="62" height="55" rx="8" className="fabric-area" fill="#d7dbdd" stroke="#3e2723" strokeWidth="1" />
    {/* Base front */}
    <rect x="36" y="185" width="194" height="35" rx="6" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
  </>
)

const ArmchairShape = () => (
  <>
    {/* Legs */}
    <g fill="#3e2723">
      <rect x="40" y="220" width="10" height="22" />
      <rect x="190" y="220" width="10" height="22" />
    </g>
    {/* Backrest (fabric) */}
    <rect x="38" y="30" width="164" height="105" rx="14" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1.5" />
    {/* Arms (fabric) */}
    <rect x="20" y="60" width="28" height="155" rx="12" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1.5" />
    <rect x="192" y="60" width="28" height="155" rx="12" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1.5" />
    {/* Seat cushion (fabric) */}
    <rect x="48" y="135" width="144" height="55" rx="10" className="fabric-area" fill="#d7dbdd" stroke="#3e2723" strokeWidth="1.5" />
    {/* Front base */}
    <rect x="48" y="190" width="144" height="30" rx="6" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
  </>
)

const BarStool = () => (
  <>
    {/* Footrest ring + center pole */}
    <g fill="#37474f">
      <ellipse cx="100" cy="220" rx="50" ry="6" />
      <rect x="97" y="100" width="6" height="125" />
    </g>
    {/* Round seat (fabric) */}
    <ellipse cx="100" cy="100" rx="60" ry="14" className="fabric-area" fill="#bdc3c7" stroke="#37474f" strokeWidth="1.5" />
    <rect x="40" y="92" width="120" height="14" className="fabric-area" fill="#bdc3c7" stroke="#37474f" strokeWidth="1" />
    {/* Small backrest (fabric) */}
    <path d="M 50 92 Q 50 50 100 50 Q 150 50 150 92 Z" className="fabric-area" fill="#bdc3c7" stroke="#37474f" strokeWidth="1.5" />
  </>
)

// ────────────────────────────────────────────────────────────────────────
// Room SVG illustrations (with curtains)
// ────────────────────────────────────────────────────────────────────────
// Each room has a window. The curtains (left + right panels) are the
// "fabric-area" elements. The window frame, walls, floor are static.

const LivingRoom = () => (
  <>
    {/* Wall */}
    <rect x="0" y="0" width="260" height="240" fill="#f5f5dc" />
    {/* Floor */}
    <rect x="0" y="200" width="260" height="40" fill="#8d6e63" />
    {/* Window */}
    <rect x="55" y="50" width="150" height="130" fill="#81d4fa" stroke="#5d4037" strokeWidth="4" />
    {/* Window cross */}
    <line x1="130" y1="50" x2="130" y2="180" stroke="#5d4037" strokeWidth="3" />
    <line x1="55" y1="115" x2="205" y2="115" stroke="#5d4037" strokeWidth="3" />
    {/* Curtain rod */}
    <rect x="35" y="42" width="190" height="5" fill="#5d4037" />
    {/* Left curtain panel (fabric) */}
    <path d="M 35 47 L 35 195 Q 38 200 45 198 Q 50 196 55 200 L 55 47 Z" className="fabric-area" fill="#bdc3c7" stroke="#5d4037" strokeWidth="1" />
    {/* Right curtain panel (fabric) */}
    <path d="M 205 47 L 205 195 Q 210 200 215 198 Q 220 196 225 200 L 225 47 Z" className="fabric-area" fill="#bdc3c7" stroke="#5d4037" strokeWidth="1" />
    {/* Pelmet (top valance) — fabric */}
    <path d="M 35 47 Q 130 70 225 47 L 225 30 L 35 30 Z" className="fabric-area" fill="#bdc3c7" stroke="#5d4037" strokeWidth="1" />
    {/* Plant on floor */}
    <rect x="20" y="180" width="14" height="14" fill="#5d4037" />
    <ellipse cx="27" cy="170" rx="10" ry="12" fill="#2e7d32" />
  </>
)

const Bedroom = () => (
  <>
    {/* Wall */}
    <rect x="0" y="0" width="260" height="240" fill="#efebe9" />
    {/* Floor */}
    <rect x="0" y="200" width="260" height="40" fill="#a1887f" />
    {/* Window */}
    <rect x="50" y="40" width="160" height="120" fill="#bbdefb" stroke="#3e2723" strokeWidth="4" />
    {/* Sheer curtain behind (semi-transparent — fabric) */}
    <rect x="40" y="35" width="180" height="135" className="fabric-area" fill="#ffffff" opacity="0.7" stroke="#3e2723" strokeWidth="1" />
    {/* Curtain rod */}
    <rect x="30" y="32" width="200" height="5" fill="#3e2723" />
    {/* Left drape panel (fabric) */}
    <path d="M 30 37 L 30 195 Q 35 200 42 198 Q 48 196 55 200 L 55 37 Z" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
    {/* Right drape panel (fabric) */}
    <path d="M 205 37 L 205 195 Q 212 200 218 198 Q 225 196 230 200 L 230 37 Z" className="fabric-area" fill="#bdc3c7" stroke="#3e2723" strokeWidth="1" />
    {/* Tiebacks (decorative, non-fabric) */}
    <circle cx="42" cy="120" r="3" fill="#d4af37" />
    <circle cx="218" cy="120" r="3" fill="#d4af37" />
    {/* Bed hint at bottom */}
    <rect x="40" y="200" width="180" height="35" fill="#fff" stroke="#3e2723" strokeWidth="1" />
    <rect x="40" y="190" width="60" height="20" rx="4" fill="#fff" stroke="#3e2723" strokeWidth="1" />
  </>
)

const OfficeRoom = () => (
  <>
    {/* Wall */}
    <rect x="0" y="0" width="260" height="240" fill="#eceff1" />
    {/* Floor */}
    <rect x="0" y="200" width="260" height="40" fill="#607d8b" />
    {/* Large window (floor to almost ceiling) */}
    <rect x="40" y="30" width="180" height="160" fill="#90caf9" stroke="#263238" strokeWidth="5" />
    {/* Window divider (vertical) */}
    <line x1="130" y1="30" x2="130" y2="190" stroke="#263238" strokeWidth="4" />
    {/* Vertical blinds — multiple strips (all fabric) */}
    {[42, 56, 70, 84, 98, 112, 134, 148, 162, 176, 190, 204].map((x, i) => (
      <rect key={i} x={x} y={32} width="10" height="156" className="fabric-area" fill="#bdc3c7" stroke="#263238" strokeWidth="0.5" />
    ))}
    {/* Top rail */}
    <rect x="38" y="28" width="184" height="6" fill="#263238" />
    {/* Bottom rail */}
    <rect x="38" y="186" width="184" height="6" fill="#263238" />
    {/* Office desk hint */}
    <rect x="20" y="180" width="40" height="40" fill="#5d4037" />
  </>
)

// ────────────────────────────────────────────────────────────────────────
// Product catalog
// ────────────────────────────────────────────────────────────────────────

const CHAIR_PRODUCTS: ProductDef[] = [
  { id: 'office-chair', type: 'chair', nameEn: 'Office Chair', nameBn: 'অফিস চেয়ার', descEn: 'High-back executive chair with cushioned seat and headrest', descBn: 'কুশন যুক্ত সিট ও হেডরেস্ট সহ হাই-ব্যাক এক্সিকিউটিভ চেয়ার', render: OfficeChair, viewBox: '0 0 200 250' },
  { id: 'dining-chair', type: 'chair', nameEn: 'Dining Chair', nameBn: 'ডাইনিং চেয়ার', descEn: 'Classic dining chair with vertical slatted back', descBn: 'উল্লম্ব স্ল্যাটেড ব্যাক সহ ক্লাসিক ডাইনিং চেয়ার', render: DiningChair, viewBox: '0 0 200 250' },
  { id: 'sofa', type: 'chair', nameEn: '3-Seater Sofa', nameBn: '৩-সিটার সোফা', descEn: 'Spacious 3-seater sofa with cushioned back and arms', descBn: 'কুশন যুক্ত ব্যাক ও আর্ম সহ প্রশস্ত ৩-সিটার সোফা', render: SofaChair, viewBox: '0 0 260 250' },
  { id: 'armchair', type: 'chair', nameEn: 'Armchair', nameBn: 'আর্মচেয়ার', descEn: 'Cozy single-seater armchair with wrapped arms', descBn: 'মোড়ানো আর্ম সহ আরামদায়ক সিঙ্গেল-সিটার আর্মচেয়ার', render: ArmchairShape, viewBox: '0 0 260 250' },
  { id: 'bar-stool', type: 'chair', nameEn: 'Bar Stool', nameBn: 'বার স্টুল', descEn: 'Tall bar stool with round cushioned seat and low back', descBn: 'গোলাকার কুশন সিট ও ছোট ব্যাক সহ লম্বা বার স্টুল', render: BarStool, viewBox: '0 0 200 250' },
]

const ROOM_PRODUCTS: ProductDef[] = [
  { id: 'living-room', type: 'room', nameEn: 'Living Room Window', nameBn: 'লিভিং রুম উইন্ডো', descEn: 'Standard window with two drape panels and pelmet', descBn: 'দুটি ড্রেপ প্যানেল ও পেলমেট সহ স্ট্যান্ডার্ড উইন্ডো', render: LivingRoom, viewBox: '0 0 260 240' },
  { id: 'bedroom', type: 'room', nameEn: 'Bedroom Window', nameBn: 'বেডরুম উইন্ডো', descEn: 'Sheer + drape combo with tiebacks for elegance', descBn: 'টাইব্যাক সহ শিয়ার + ড্রেপ কম্বো', render: Bedroom, viewBox: '0 0 260 240' },
  { id: 'office-room', type: 'room', nameEn: 'Office Window', nameBn: 'অফিস উইন্ডো', descEn: 'Vertical blinds for modern office aesthetic', descBn: 'আধুনিক অফিস অ্যাস্থেটিকের জন্য ভার্টিকাল ব্লাইন্ড', render: OfficeRoom, viewBox: '0 0 260 240' },
]

const ALL_PRODUCTS = [...CHAIR_PRODUCTS, ...ROOM_PRODUCTS]

// ────────────────────────────────────────────────────────────────────────
// Preset fabrics (data-URL SVGs so they load instantly, no network)
// ────────────────────────────────────────────────────────────────────────

const svgToDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

const PRESET_FABRICS: FabricDef[] = [
  {
    id: 'preset-floral',
    nameEn: 'Floral Cream',
    nameBn: 'ফ্লোরাল ক্রিম',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23fdf6e3'/><g fill='%23d97706' opacity='0.8'><circle cx='40' cy='40' r='12'/><circle cx='40' cy='40' r='5' fill='%2392400e'/><circle cx='140' cy='60' r='12'/><circle cx='140' cy='60' r='5' fill='%2392400e'/><circle cx='80' cy='120' r='12'/><circle cx='80' cy='120' r='5' fill='%2392400e'/><circle cx='170' cy='150' r='12'/><circle cx='170' cy='150' r='5' fill='%2392400e'/><circle cx='30' cy='170' r='12'/><circle cx='30' cy='170' r='5' fill='%2392400e'/></g><g stroke='%23a16207' stroke-width='1' fill='none' opacity='0.6'><path d='M40 52 Q60 70 80 120'/><path d='M140 72 Q120 90 80 120'/><path d='M170 162 Q120 160 80 132'/><path d='M30 158 Q60 145 78 132'/></g></svg>`),
  },
  {
    id: 'preset-stripes',
    nameEn: 'Navy Stripes',
    nameBn: 'নেভি স্ট্রাইপ',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%231e3a8a'/><g fill='%23ffffff'><rect x='0' y='0' width='25' height='200'/><rect x='50' y='0' width='25' height='200'/><rect x='100' y='0' width='25' height='200'/><rect x='150' y='0' width='25' height='200'/></g></svg>`),
  },
  {
    id: 'preset-checkered',
    nameEn: 'Checkered Gray',
    nameBn: 'চেকার্ড গ্রে',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><pattern id='c' width='40' height='40' patternUnits='userSpaceOnUse'><rect width='20' height='20' fill='%23374151'/><rect x='20' y='20' width='20' height='20' fill='%23374151'/><rect x='20' y='0' width='20' height='20' fill='%23d1d5db'/><rect x='0' y='20' width='20' height='20' fill='%23d1d5db'/></pattern></defs><rect width='200' height='200' fill='url(%23c)'/></svg>`),
  },
  {
    id: 'preset-velvet',
    nameEn: 'Burgundy Velvet',
    nameBn: 'বারগান্ডি ভেলভেট',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><radialGradient id='v' cx='50%' cy='50%' r='70%'><stop offset='0%' stop-color='%237f1d1d'/><stop offset='100%' stop-color='%23450a0a'/></radialGradient></defs><rect width='200' height='200' fill='url(%23v)'/><g stroke='%23991313' stroke-width='0.5' opacity='0.4'><line x1='0' y1='20' x2='200' y2='20'/><line x1='0' y1='60' x2='200' y2='60'/><line x1='0' y1='100' x2='200' y2='100'/><line x1='0' y1='140' x2='200' y2='140'/><line x1='0' y1='180' x2='200' y2='180'/></g></svg>`),
  },
  {
    id: 'preset-geometric',
    nameEn: 'Geometric Teal',
    nameBn: 'জিওমেট্রিক টিল',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%2399f6e4'/><g fill='%230f766e'><polygon points='40,40 70,40 55,15'/><polygon points='120,40 150,40 135,15'/><polygon points='40,120 70,120 55,95'/><polygon points='120,120 150,120 135,95'/><polygon points='40,180 70,180 55,155'/><polygon points='120,180 150,180 135,155'/></g><g fill='%23115e59'><polygon points='80,80 110,80 95,55'/><polygon points='160,80 190,80 175,55'/><polygon points='80,160 110,160 95,135'/><polygon points='160,160 190,160 175,135'/></g></svg>`),
  },
  {
    id: 'preset-linen',
    nameEn: 'Natural Linen',
    nameBn: 'ন্যাচারাল লিনেন',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23e7e5e4'/><g stroke='%23a8a29e' stroke-width='0.7' opacity='0.6'>${Array.from({ length: 40 }, (_, i) => `<line x1='0' y1='${i * 5}' x2='200' y2='${i * 5}'/>`).join('')}${Array.from({ length: 40 }, (_, i) => `<line x1='${i * 5}' y1='0' x2='${i * 5}' y2='200' opacity='0.4'/>`).join('')}</g></svg>`),
  },
]

// ────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────

interface FabricStudioProps {
  /** Called when user clicks "Place Order". Receives the selected product
   *  and fabric info so the parent can pre-fill the booking form. */
  onPlaceOrder?: (product: ProductDef, fabric: FabricDef | null) => void
}

export default function FabricStudio({ onPlaceOrder }: FabricStudioProps) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<'chair' | 'room'>('chair')
  const [selectedProductId, setSelectedProductId] = useState<string>(CHAIR_PRODUCTS[0].id)
  const [fabrics, setFabrics] = useState<FabricDef[]>(PRESET_FABRICS)
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(PRESET_FABRICS[0].id)
  const [fabricScale, setFabricScale] = useState<number>(100) // percentage, 50–200
  const [fabricOffsetX, setFabricOffsetX] = useState<number>(0)
  const [fabricOffsetY, setFabricOffsetY] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load user-uploaded fabrics from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dfcl-fabric-studio-uploads')
      if (saved) {
        const parsed: FabricDef[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFabrics(prev => [...parsed, ...prev])
        }
      }
    } catch {}
  }, [])

  // Persist user-uploaded fabrics to localStorage
  const persistUploads = (uploads: FabricDef[]) => {
    try { localStorage.setItem('dfcl-fabric-studio-uploads', JSON.stringify(uploads)) } catch {}
  }

  const selectedProduct = useMemo(
    () => ALL_PRODUCTS.find(p => p.id === selectedProductId) || CHAIR_PRODUCTS[0],
    [selectedProductId]
  )

  const selectedFabric = useMemo(
    () => fabrics.find(f => f.id === selectedFabricId) || null,
    [fabrics, selectedFabricId]
  )

  // Switch tab → pick first product of that tab
  const handleTabChange = (newTab: 'chair' | 'room') => {
    setTab(newTab)
    const first = newTab === 'chair' ? CHAIR_PRODUCTS[0] : ROOM_PRODUCTS[0]
    setSelectedProductId(first.id)
  }

  // Cycle to next/previous product within current tab
  const cycleProduct = (dir: 1 | -1) => {
    const list = tab === 'chair' ? CHAIR_PRODUCTS : ROOM_PRODUCTS
    const idx = list.findIndex(p => p.id === selectedProductId)
    const next = (idx + dir + list.length) % list.length
    setSelectedProductId(list[next].id)
  }

  // Upload handler — converts image file to data URL
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert(t('Please select an image file', 'অনুগ্রহ করে একটি ছবি ফাইল নির্বাচন করুন'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(t('Image must be under 5 MB', 'ছবি ৫ মেগাবাইটের নিচে হতে হবে'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const newFabric: FabricDef = {
        id: `upload-${Date.now()}`,
        nameEn: file.name.replace(/\.[^.]+$/, '').slice(0, 30),
        nameBn: file.name.replace(/\.[^.]+$/, '').slice(0, 30),
        url: dataUrl,
        uploaded: true,
      }
      setFabrics(prev => {
        const newUploads = [newFabric, ...prev.filter(f => f.uploaded)]
        persistUploads(newUploads)
        return [newFabric, ...prev]
      })
      setSelectedFabricId(newFabric.id)
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Delete an uploaded fabric
  const handleDeleteFabric = (id: string) => {
    setFabrics(prev => {
      const filtered = prev.filter(f => f.id !== id)
      persistUploads(filtered.filter(f => f.uploaded))
      return filtered
    })
    if (selectedFabricId === id) setSelectedFabricId(null)
  }

  // Reset view
  const handleReset = () => {
    setFabricScale(100)
    setFabricOffsetX(0)
    setFabricOffsetY(0)
  }

  const currentList = tab === 'chair' ? CHAIR_PRODUCTS : ROOM_PRODUCTS

  // Pattern size derived from scale — base 100 units (matches viewBox),
  // scaled by fabricScale/100.
  const patternSize = (selectedProduct.viewBox.split(' ')[2] ? parseFloat(selectedProduct.viewBox.split(' ')[2]) : 200) * (fabricScale / 100)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-600" />
            {t('Fabric Studio', 'ফ্যাব্রিক স্টুডিও')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('Select a product, upload your fabric, and see how it looks before ordering.', 'একটি পণ্য নির্বাচন করুন, আপনার ফ্যাব্রিক আপলোড করুন, এবং অর্ডার করার আগে দেখুন কেমন দেখাবে।')}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => handleTabChange(v as 'chair' | 'room')}>
        <TabsList>
          <TabsTrigger value="chair"><ArmchairIcon className="w-4 h-4 mr-1.5" />{t('Chairs', 'চেয়ার')}</TabsTrigger>
          <TabsTrigger value="room"><HomeIcon className="w-4 h-4 mr-1.5" />{t('Curtains in Rooms', 'রুমে কার্টেইন')}</TabsTrigger>
        </TabsList>

        {/* Product gallery — horizontal scroll */}
        <TabsContent value="chair" className="mt-3">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {CHAIR_PRODUCTS.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                selected={selectedProductId === p.id}
                onSelect={() => setSelectedProductId(p.id)}
                t={t}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="room" className="mt-3">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {ROOM_PRODUCTS.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                selected={selectedProductId === p.id}
                onSelect={() => setSelectedProductId(p.id)}
                t={t}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Main preview + fabric controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Preview area (2 cols on lg) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Maximize2 className="w-4 h-4" />
                {t(selectedProduct.nameEn, selectedProduct.nameBn)}
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cycleProduct(-1)} title={t('Previous', 'পূর্ববর্তী')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cycleProduct(1)} title={t('Next', 'পরবর্তী')}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t(selectedProduct.descEn, selectedProduct.descBn)}</p>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 flex items-center justify-center min-h-[400px]">
              <ProductPreview
                product={selectedProduct}
                fabric={selectedFabric}
                patternSize={patternSize}
                offsetX={fabricOffsetX}
                offsetY={fabricOffsetY}
              />
            </div>
            {selectedFabric && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {t('Fabric:', 'ফ্যাব্রিক:')} <span className="font-medium text-foreground">{t(selectedFabric.nameEn, selectedFabric.nameBn)}</span>
                {' · '}{t('Scale:', 'স্কেল:')} {fabricScale}%
              </p>
            )}
          </CardContent>
        </Card>

        {/* Fabric controls (1 col on lg) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('Fabric Selection', 'ফ্যাব্রিক নির্বাচন')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <Button
                variant="default"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {t('Upload Your Fabric', 'আপনার ফ্যাব্রিক আপলোড করুন')}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {t('JPG / PNG / WebP up to 5 MB', 'JPG / PNG / WebP — সর্বোচ্চ ৫ মেগাবাইট')}
              </p>
            </div>

            {/* Fabric gallery — preset + uploaded */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('Preset & Uploaded Fabrics', 'প্রিসেট ও আপলোড করা ফ্যাব্রিক')}</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {fabrics.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFabricId(f.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selectedFabricId === f.id ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-400'}`}
                    title={t(f.nameEn, f.nameBn)}
                  >
                    <img src={f.url} alt={f.nameEn} className="w-full h-full object-cover" />
                    {selectedFabricId === f.id && (
                      <span className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                    {f.uploaded && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteFabric(f.id) }}
                        className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600"
                        title={t('Remove', 'মুছুন')}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale + offset controls — only enabled when a fabric is selected */}
            {selectedFabric ? (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Fabric Scale', 'ফ্যাব্রিক স্কেল')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricScale}%</span>
                  </div>
                  <Slider value={[fabricScale]} min={30} max={200} step={5} onValueChange={v => setFabricScale(v[0])} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Horizontal Offset', 'অনুভূমিক অফসেট')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricOffsetX}</span>
                  </div>
                  <Slider value={[fabricOffsetX]} min={-100} max={100} step={2} onValueChange={v => setFabricOffsetX(v[0])} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Vertical Offset', 'উল্লম্ব অফসেট')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricOffsetY}</span>
                  </div>
                  <Slider value={[fabricOffsetY]} min={-100} max={100} step={2} onValueChange={v => setFabricOffsetY(v[0])} />
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {t('Reset Adjustments', 'সমন্বয় রিসেট করুন')}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                {t('Pick or upload a fabric to see the preview', 'প্রিভিউ দেখতে একটি ফ্যাব্রিক নির্বাচন করুন বা আপলোড করুন')}
              </p>
            )}

            {/* Place Order button */}
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800"
              onClick={() => onPlaceOrder?.(selectedProduct, selectedFabric)}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('Place Order with This Fabric', 'এই ফ্যাব্রিক দিয়ে অর্ডার করুন')}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              {t('You will be redirected to the booking page with this product pre-filled.', 'এই পণ্য পূর্ব-পূরণ সহ আপনাকে বুকিং পেজে নিয়ে যাওয়া হবে।')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────

function ProductCard({
  product,
  selected,
  onSelect,
  t,
}: {
  product: ProductDef
  selected: boolean
  onSelect: () => void
  t: (en: string, bn: string) => string
}) {
  return (
    <button
      onClick={onSelect}
      className={`shrink-0 w-32 rounded-xl overflow-hidden border-2 bg-white transition-all text-left ${selected ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}
    >
      <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 p-2">
        <svg viewBox={product.viewBox} className="w-full h-full">
          <ProductBody product={product} />
        </svg>
      </div>
      <div className="p-2 border-t border-slate-100">
        <p className="text-xs font-medium text-foreground truncate">{t(product.nameEn, product.nameBn)}</p>
      </div>
    </button>
  )
}

function ProductBody({ product }: { product: ProductDef }) {
  // Render the SVG body with default neutral fabric (no pattern overlay).
  return <g>{product.render()}</g>
}

function ProductPreview({
  product,
  fabric,
  patternSize,
  offsetX,
  offsetY,
}: {
  product: ProductDef
  fabric: FabricDef | null
  patternSize: number
  offsetX: number
  offsetY: number
}) {
  // When no fabric is selected, render the SVG body as-is (default neutral fill).
  if (!fabric) {
    return (
      <svg viewBox={product.viewBox} className="w-full max-w-md h-auto drop-shadow-xl">
        <ProductBody product={product} />
      </svg>
    )
  }

  // When a fabric is selected, we need to:
  //   1. Inject a <pattern> into <defs> with the fabric image.
  //   2. Override all "fabric-area" elements to fill with the pattern.
  //
  // We do this by rendering the product body inside an SVG that has the
  // pattern defs, then applying a CSS rule that overrides .fabric-area
  // fills via inline style.
  return (
    <svg viewBox={product.viewBox} className="w-full max-w-md h-auto drop-shadow-xl">
      <defs>
        <pattern
          id="fabric-pattern"
          patternUnits="userSpaceOnUse"
          width={patternSize}
          height={patternSize}
          x={offsetX}
          y={offsetY}
          preserveAspectRatio="xMidYMid slice"
        >
          <image
            href={fabric.url}
            x="0"
            y="0"
            width={patternSize}
            height={patternSize}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      </defs>
      <g>
        {/* Render product body, then override fabric-area fills via a duplicate rendering with fill="url(#fabric-pattern)" */}
        <ProductBody product={product} />
        {/* Overlay the same body with the pattern fill applied to fabric areas.
            We use a <style> block scoped to this SVG to set the fill on .fabric-area. */}
        <style>{`.fabric-area { fill: url(#fabric-pattern) !important; }`}</style>
      </g>
    </svg>
  )
}
