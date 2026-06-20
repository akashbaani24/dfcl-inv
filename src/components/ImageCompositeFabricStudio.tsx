'use client'

/**
 * ★ Fabric Studio — Image Composite Edition
 * -------------------------------------------------------------
 * Uses REAL product photos (not procedural 3D) so the result looks
 * 100% photorealistic. The fabric-able areas (sofa seat, backrest,
 * cushions, pillows) are defined as SVG mask paths overlaying the
 * photo. Uploaded fabric pattern is repeated as a tiled texture
 * within those masked areas, with adjustable scale + opacity.
 *
 * Customer flow:
 *   1. Pick a product (real photo + matching SVG mask)
 *   2. Upload fabric or pick a preset
 *   3. Adjust scale + opacity sliders
 *   4. See the fabric applied to the real sofa photo
 *   5. Place Order
 *
 * Photos live in /public/fabric-studio/
 * Mask paths are hand-tuned to match each photo's sofa area.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useLanguage } from '@/lib/i18n'
import { Upload, ShoppingCart, RotateCcw, Wand2, Check, X, Maximize2, Move3d } from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

interface ProductDef {
  id: string
  nameEn: string
  nameBn: string
  descEn: string
  descBn: string
  /** Path to the real product photo in /public */
  photoUrl: string
  /** Natural dimensions of the photo (used to scale mask coordinates) */
  photoWidth: number
  photoHeight: number
  /** SVG mask path(s) defining the fabric-able areas. Each path is
   *  drawn in the photo's natural coordinate system. Multiple paths
   *  can be combined into a single string with the Z command. */
  maskPath: string
}

interface FabricDef {
  id: string
  nameEn: string
  nameBn: string
  url: string
  uploaded?: boolean
}

// ────────────────────────────────────────────────────────────────────────
// Preset fabrics (data-URL SVGs)
// ────────────────────────────────────────────────────────────────────────

const svgToDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

const PRESET_FABRICS: FabricDef[] = [
  {
    id: 'preset-floral',
    nameEn: 'Floral Cream',
    nameBn: 'ফ্লোরাল ক্রিম',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23fdf6e3'/><g fill='%23d97706' opacity='0.85'><circle cx='40' cy='40' r='13'/><circle cx='40' cy='40' r='5' fill='%2392400e'/><circle cx='140' cy='60' r='13'/><circle cx='140' cy='60' r='5' fill='%2392400e'/><circle cx='80' cy='120' r='13'/><circle cx='80' cy='120' r='5' fill='%2392400e'/><circle cx='170' cy='150' r='13'/><circle cx='170' cy='150' r='5' fill='%2392400e'/><circle cx='30' cy='170' r='13'/><circle cx='30' cy='170' r='5' fill='%2392400e'/></g></svg>`),
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
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><radialGradient id='v' cx='50%' cy='50%' r='70%'><stop offset='0%' stop-color='%237f1d1d'/><stop offset='100%' stop-color='%23450a0a'/></radialGradient></defs><rect width='200' height='200' fill='url(%23v)'/></svg>`),
  },
  {
    id: 'preset-geometric',
    nameEn: 'Geometric Teal',
    nameBn: 'জিওমেট্রিক টিল',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%2399f6e4'/><g fill='%230f766e'><polygon points='40,40 70,40 55,15'/><polygon points='120,40 150,40 135,15'/><polygon points='40,120 70,120 55,95'/><polygon points='120,120 150,120 135,95'/><polygon points='40,180 70,180 55,155'/><polygon points='120,180 150,180 135,155'/></g></svg>`),
  },
  {
    id: 'preset-linen',
    nameEn: 'Natural Linen',
    nameBn: 'ন্যাচারাল লিনেন',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23e7e5e4'/><g stroke='%23a8a29e' stroke-width='0.7' opacity='0.6'>${Array.from({ length: 40 }, (_, i) => `<line x1='0' y1='${i * 5}' x2='200' y2='${i * 5}'/>`).join('')}</g></svg>`),
  },
  {
    id: 'preset-mustard',
    nameEn: 'Mustard Yellow',
    nameBn: 'মাস্টার্ড ইয়েলো',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='m' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23eab308'/><stop offset='100%' stop-color='%23a16207'/></linearGradient></defs><rect width='200' height='200' fill='url(%23m)'/></svg>`),
  },
  {
    id: 'preset-emerald',
    nameEn: 'Emerald Green',
    nameBn: 'এমেরাল্ড গ্রিন',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='e' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%2310b981'/><stop offset='100%' stop-color='%23065f46'/></linearGradient></defs><rect width='200' height='200' fill='url(%23e)'/></svg>`),
  },
]

// ────────────────────────────────────────────────────────────────────────
// Product catalog — real photos + hand-tuned SVG masks
// ────────────────────────────────────────────────────────────────────────
// Each maskPath covers the fabric-able areas of the sofa in that
// specific photo. Coordinates are in the photo's natural pixel space
// (matching photoWidth × photoHeight). The mask is rendered as an
// SVG <path> with a <pattern> fill, scaled to fit the displayed image.

const PRODUCTS: ProductDef[] = [
  {
    id: 'living-room-scene',
    nameEn: 'Living Room Scene',
    nameBn: 'লিভিং রুম সিন',
    descEn: 'Grey sofa in a styled living room with cabinet + plant + poster',
    descBn: 'ক্যাবিনেট + গাছ + পোস্টার সহ সাজানো লিভিং রুমে ধূসর সোফা',
    photoUrl: '/fabric-studio/scene-living-room.jpg',
    photoWidth: 612,
    photoHeight: 405,
    // Sofa in this photo sits roughly at x=180-460, y=200-360.
    // Mask covers seat cushion + backrest.
    maskPath: 'M 180 220 Q 180 215 185 215 L 455 215 Q 460 215 460 220 L 460 280 Q 460 290 450 295 L 190 295 Q 180 290 180 280 Z M 185 200 Q 185 195 195 195 L 445 195 Q 455 195 455 200 L 455 220 Q 455 225 445 225 L 195 225 Q 185 225 185 220 Z',
  },
  {
    id: 'barrel-back-sofa',
    nameEn: 'Barrel-Back Sofa',
    nameBn: 'ব্যারেল-ব্যাক সোফা',
    descEn: 'Curved barrel-back sofa with channel-tufted backrest',
    descBn: 'চ্যানেল-টাফটেড ব্যাকরেস্ট সহ বাঁকা ব্যারেল-ব্যাক সোফা',
    photoUrl: '/fabric-studio/sofa-barrel-back.jpg',
    photoWidth: 860,
    photoHeight: 860,
    // Square photo — sofa centered. Mask covers seat + curved backrest.
    maskPath: 'M 220 380 Q 220 360 240 350 L 620 350 Q 640 360 640 380 L 640 470 Q 640 490 620 500 L 240 500 Q 220 490 220 470 Z M 240 200 Q 240 180 260 180 L 600 180 Q 620 180 620 200 L 630 340 Q 630 360 610 360 L 250 360 Q 230 360 230 340 Z',
  },
  {
    id: 'white-loveseat',
    nameEn: 'White Loveseat',
    nameBn: 'হোয়াইট লাভসিট',
    descEn: 'Modern 2-seater loveseat with rounded cushions + throw pillows',
    descBn: 'গোলাকার কুশন + থ্রো পিলো সহ মডার্ন ২-সিটার লাভসিট',
    photoUrl: '/fabric-studio/sofa-white-loveseat.jpg',
    photoWidth: 612,
    photoHeight: 408,
    // Loveseat centered in landscape photo. Mask covers both seat cushions
    // + backrest + accent pillows.
    maskPath: 'M 100 200 Q 100 195 110 195 L 510 195 Q 520 195 520 200 L 520 245 Q 520 252 510 252 L 110 252 Q 100 252 100 245 Z M 120 150 Q 120 145 130 145 L 490 145 Q 500 145 500 150 L 500 200 Q 500 210 490 210 L 130 210 Q 120 210 120 200 Z',
  },
]

// ────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────

interface ImageCompositeFabricStudioProps {
  onPlaceOrder?: (product: ProductDef, fabric: FabricDef | null) => void
}

export default function ImageCompositeFabricStudio({ onPlaceOrder }: ImageCompositeFabricStudioProps) {
  const { t } = useLanguage()
  const [selectedProductId, setSelectedProductId] = useState<string>(PRODUCTS[0].id)
  const [fabrics, setFabrics] = useState<FabricDef[]>(PRESET_FABRICS)
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(PRESET_FABRICS[0].id)
  const [fabricScale, setFabricScale] = useState<number>(100) // percentage, 20-300
  const [fabricOpacity, setFabricOpacity] = useState<number>(85) // 0-100
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load user-uploaded fabrics from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dfcl-fabric-studio-image-uploads')
      if (saved) {
        const parsed: FabricDef[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFabrics(prev => [...parsed, ...prev])
        }
      }
    } catch {}
  }, [])

  const persistUploads = (uploads: FabricDef[]) => {
    try { localStorage.setItem('dfcl-fabric-studio-image-uploads', JSON.stringify(uploads)) } catch {}
  }

  const selectedProduct = useMemo(
    () => PRODUCTS.find(p => p.id === selectedProductId) || PRODUCTS[0],
    [selectedProductId]
  )

  const selectedFabric = useMemo(
    () => fabrics.find(f => f.id === selectedFabricId) || null,
    [fabrics, selectedFabricId]
  )

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

  const handleDeleteFabric = (id: string) => {
    setFabrics(prev => {
      const filtered = prev.filter(f => f.id !== id)
      persistUploads(filtered.filter(f => f.uploaded))
      return filtered
    })
    if (selectedFabricId === id) setSelectedFabricId(null)
  }

  const handleReset = () => {
    setFabricScale(100)
    setFabricOpacity(85)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-indigo-600" />
          {t('Fabric Studio', 'ফ্যাব্রিক স্টুডিও')}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('Pick a product, upload your fabric, and see it on a real photo.', 'একটি পণ্য নির্বাচন করুন, আপনার ফ্যাব্রিক আপলোড করুন, এবং বাস্তব ছবিতে দেখুন।')}
        </p>
      </div>

      {/* Product gallery */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {PRODUCTS.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProductId(p.id)}
            className={`shrink-0 w-44 rounded-xl overflow-hidden border-2 bg-white transition-all text-left ${selectedProductId === p.id ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}
          >
            <div className="aspect-[4/3] overflow-hidden bg-slate-100">
              <img src={p.photoUrl} alt={p.nameEn} className="w-full h-full object-cover" />
            </div>
            <div className="p-2 border-t border-slate-100">
              <p className="text-xs font-medium text-foreground truncate">{t(p.nameEn, p.nameBn)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Main preview + fabric controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Preview area */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              {t(selectedProduct.nameEn, selectedProduct.nameBn)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t(selectedProduct.descEn, selectedProduct.descBn)}</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden relative bg-slate-100">
              {/* The real product photo as background */}
              <div className="relative w-full" style={{ aspectRatio: `${selectedProduct.photoWidth} / ${selectedProduct.photoHeight}` }}>
                <img
                  src={selectedProduct.photoUrl}
                  alt={selectedProduct.nameEn}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
                {/* SVG overlay with fabric pattern inside mask */}
                {selectedFabric && (
                  <svg
                    viewBox={`0 0 ${selectedProduct.photoWidth} ${selectedProduct.photoHeight}`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full"
                    style={{ mixBlendMode: 'multiply' }}
                  >
                    <defs>
                      <pattern
                        id="fabric-pattern-overlay"
                        patternUnits="userSpaceOnUse"
                        width={selectedProduct.photoWidth * (fabricScale / 100) / 4}
                        height={selectedProduct.photoWidth * (fabricScale / 100) / 4}
                      >
                        <image
                          href={selectedFabric.url}
                          x="0"
                          y="0"
                          width={selectedProduct.photoWidth * (fabricScale / 100) / 4}
                          height={selectedProduct.photoWidth * (fabricScale / 100) / 4}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </pattern>
                      <clipPath id="fabric-clip">
                        <path d={selectedProduct.maskPath} />
                      </clipPath>
                    </defs>
                    {/* Fabric-filled shape clipped to mask path */}
                    <path
                      d={selectedProduct.maskPath}
                      fill="url(#fabric-pattern-overlay)"
                      opacity={fabricOpacity / 100}
                      clipPath="url(#fabric-clip)"
                    />
                  </svg>
                )}
              </div>
            </div>
            {selectedFabric ? (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {t('Fabric:', 'ফ্যাব্রিক:')} <span className="font-medium text-foreground">{t(selectedFabric.nameEn, selectedFabric.nameBn)}</span>
                {' · '}{t('Scale:', 'স্কেল:')} {fabricScale}%{' · '}{t('Opacity:', 'অপাসিটি:')} {fabricOpacity}%
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center mt-2">
                {t('Pick or upload a fabric to see it on the sofa', 'সোফায় দেখতে একটি ফ্যাব্রিক নির্বাচন করুন বা আপলোড করুন')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Fabric controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('Fabric Selection', 'ফ্যাব্রিক নির্বাচন')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload */}
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
                {t('JPG / PNG / WebP up to 5 MB · pattern auto-repeats', 'JPG / PNG / WebP — সর্বোচ্চ ৫ মেগাবাইট · প্যাটার্ন অটো-রিপিট হবে')}
              </p>
            </div>

            {/* Fabric gallery */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('Preset & Uploaded Fabrics', 'প্রিসেট ও আপলোড করা ফ্যাব্রিক')}</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
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

            {/* Scale + Opacity */}
            {selectedFabric && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Pattern Scale', 'প্যাটার্ন স্কেল')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricScale}%</span>
                  </div>
                  <Slider value={[fabricScale]} min={20} max={300} step={5} onValueChange={v => setFabricScale(v[0])} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t('Higher = smaller pattern (more repeats).', 'বেশি = ছোট প্যাটার্ন (বেশি রিপিট)।')}
                  </p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Opacity', 'অপাসিটি')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricOpacity}%</span>
                  </div>
                  <Slider value={[fabricOpacity]} min={20} max={100} step={5} onValueChange={v => setFabricOpacity(v[0])} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t('Lower = more of original sofa visible through fabric.', 'কম = ফ্যাব্রিকের নিচে মূল সোফা বেশি দৃশ্যমান।')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {t('Reset', 'রিসেট')}
                </Button>
              </div>
            )}

            {/* Place Order */}
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800"
              onClick={() => onPlaceOrder?.(selectedProduct, selectedFabric)}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('Place Order with This Fabric', 'এই ফ্যাব্রিক দিয়ে অর্ডার করুন')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
