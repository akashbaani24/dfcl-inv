'use client'

/**
 * ★ Fabric Studio — Image Composite with Interactive Mask + Zoom/Pan
 * -------------------------------------------------------------
 * Real product photos with hand-tuned SVG masks. Customer can:
 *   1. Pick a product (real photo)
 *   2. Upload fabric or pick a preset
 *   3. Adjust fabric scale + opacity
 *   4. ★ ZOOM in/out (mouse wheel or buttons)
 *   5. ★ PAN around (click-drag when zoomed in)
 *   6. ★ SHOW/HIDE mask outline so they can see where fabric will apply
 *   7. ★ ADJUST mask position/size by dragging (if mask doesn't match)
 *   8. Place Order
 *
 * The mask is rendered as an SVG <rect> overlay with drag handles so
 * the customer can move/resize it to perfectly match the sofa in the
 * photo — this solves the "image upload করলে match করে না" problem
 * because each user can fine-tune the mask for their own photo.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useLanguage } from '@/lib/i18n'
import { Upload, ShoppingCart, RotateCcw, Wand2, Check, X, Maximize2, ZoomIn, ZoomOut, Eye, EyeOff, Move } from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

interface MaskRect {
  x: number
  y: number
  width: number
  height: number
}

interface ProductDef {
  id: string
  nameEn: string
  nameBn: string
  descEn: string
  descBn: string
  photoUrl: string
  photoWidth: number
  photoHeight: number
  /** Initial mask rectangle in photo natural coordinates (pixel space). */
  initialMask: MaskRect
}

interface FabricDef {
  id: string
  nameEn: string
  nameBn: string
  url: string
  uploaded?: boolean
}

// ────────────────────────────────────────────────────────────────────────
// Preset fabrics
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
// Product catalog — real photos with initial mask rects
// ────────────────────────────────────────────────────────────────────────
// Mask rectangles are in photo natural pixel coordinates. The user
// can drag/resize the mask in the UI to perfectly align with the sofa
// in their photo. So even if these initial values aren't perfect, the
// customer can fix them.

const PRODUCTS: ProductDef[] = [
  {
    id: 'living-room-scene',
    nameEn: 'Living Room Scene',
    nameBn: 'লিভিং রুম সিন',
    descEn: 'Grey sofa in a styled living room',
    descBn: 'সাজানো লিভিং রুমে ধূসর সোফা',
    photoUrl: '/fabric-studio/scene-living-room.jpg',
    photoWidth: 612,
    photoHeight: 405,
    // Sofa centered, covers most of the lower half
    initialMask: { x: 180, y: 200, width: 280, height: 100 },
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
    // Square photo — sofa takes ~50% width, ~40% height, centered
    initialMask: { x: 220, y: 380, width: 420, height: 200 },
  },
  {
    id: 'white-loveseat',
    nameEn: 'White Loveseat',
    nameBn: 'হোয়াইট লাভসিট',
    descEn: 'Modern 2-seater loveseat with rounded cushions',
    descBn: 'গোলাকার কুশন সহ মডার্ন ২-সিটার লাভসিট',
    photoUrl: '/fabric-studio/sofa-white-loveseat.jpg',
    photoWidth: 612,
    photoHeight: 408,
    // Loveseat centered, seat + backrest
    initialMask: { x: 100, y: 150, width: 420, height: 110 },
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
  const [fabricScale, setFabricScale] = useState<number>(100)
  const [fabricOpacity, setFabricOpacity] = useState<number>(85)

  // ★ Zoom + Pan state
  const [zoom, setZoom] = useState<number>(1) // 1 = fit, up to 4
  const [panX, setPanX] = useState<number>(0) // in pixels
  const [panY, setPanY] = useState<number>(0)

  // ★ Mask state — current mask rect (in photo natural coords)
  const [maskRect, setMaskRect] = useState<MaskRect>(PRODUCTS[0].initialMask)
  const [showMask, setShowMask] = useState<boolean>(true)

  // ★ Drag state for mask
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'>('none')
  const [dragStart, setDragStart] = useState<{ x: number, y: number, mask: MaskRect } | null>(null)

  // ★ Drag state for pan
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [panStart, setPanStart] = useState<{ x: number, y: number, panX: number, panY: number } | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
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

  // Reset mask + zoom when product changes
  useEffect(() => {
    setMaskRect(selectedProduct.initialMask)
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [selectedProduct])

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

  const handleResetView = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  const handleResetAll = () => {
    setFabricScale(100)
    setFabricOpacity(85)
    setMaskRect(selectedProduct.initialMask)
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  // Convert a screen coordinate (from a mouse event) to photo-natural
  // coordinates. This is needed because the photo is displayed at
  // some size (with zoom + pan applied) but the mask is stored in
  // natural pixel coordinates.
  const screenToPhoto = useCallback((clientX: number, clientY: number): { x: number, y: number } => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    // Position relative to container, in displayed CSS pixels
    const relX = clientX - rect.left
    const relY = clientY - rect.top
    // Container's display area dimensions
    const displayW = rect.width
    const displayH = rect.height
    // The photo is fit inside the container with object-contain style.
    // We need to undo the zoom + pan + aspect-fit transform.
    // Strategy: the SVG <svg viewBox> covers the entire photo natural size,
    // and it's rendered to fill the container with preserveAspectRatio="none"
    // BUT inside a div that has the zoom + pan transform.
    // Actually simpler: use the SVG's getScreenCTM via the svgRef.

    // For now, use a manual calculation:
    // The displayed photo width = container width (since object-contain fills width)
    // The displayed photo height = container height * (photoH/photoW)
    // Then panX/panY offset and zoom scale.
    const photoAR = selectedProduct.photoWidth / selectedProduct.photoHeight
    const containerAR = displayW / displayH
    let displayedPhotoW: number, displayedPhotoH: number
    let offsetX: number, offsetY: number
    if (containerAR > photoAR) {
      // Container is wider — photo fits by height, centered horizontally
      displayedPhotoH = displayH
      displayedPhotoW = displayH * photoAR
      offsetX = (displayW - displayedPhotoW) / 2
      offsetY = 0
    } else {
      // Container is taller — photo fits by width, centered vertically
      displayedPhotoW = displayW
      displayedPhotoH = displayW / photoAR
      offsetX = 0
      offsetY = (displayH - displayedPhotoH) / 2
    }
    // Apply zoom (centered on container center)
    const cx = displayW / 2
    const cy = displayH / 2
    const zoomedX = cx + (relX - cx) * zoom + panX
    const zoomedY = cy + (relY - cy) * zoom + panY
    // Convert from displayed photo pixel coords to natural photo coords
    const photoX = ((zoomedX - offsetX) / displayedPhotoW) * selectedProduct.photoWidth
    const photoY = ((zoomedY - offsetY) / displayedPhotoH) * selectedProduct.photoHeight
    return { x: photoX, y: photoY }
  }, [selectedProduct, zoom, panX, panY])

  // ★ Mouse handlers for mask dragging (move + resize from corners)
  const handleMaskMouseDown = (e: React.MouseEvent, mode: 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se') => {
    e.stopPropagation()
    e.preventDefault()
    setDragMode(mode)
    setDragStart({ x: e.clientX, y: e.clientY, mask: { ...maskRect } })
  }

  // ★ Mouse handlers for panning when zoomed in
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    // Only pan if we're zoomed in and clicking on background (not on mask handles)
    if (zoom > 1 && (e.target as HTMLElement).dataset.role === 'pan-surface') {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY, panX, panY })
    }
  }

  // Global mouse move + up handlers
  useEffect(() => {
    if (dragMode === 'none' && !isPanning) return

    const handleMove = (e: MouseEvent) => {
      if (dragMode !== 'none' && dragStart) {
        const photoCoords = screenToPhoto(e.clientX, e.clientY)
        const startPhotoCoords = screenToPhoto(dragStart.x, dragStart.y)
        const dx = photoCoords.x - startPhotoCoords.x
        const dy = photoCoords.y - startPhotoCoords.y
        const start = dragStart.mask
        let newRect: MaskRect
        if (dragMode === 'move') {
          newRect = {
            x: Math.max(0, Math.min(selectedProduct.photoWidth - start.width, start.x + dx)),
            y: Math.max(0, Math.min(selectedProduct.photoHeight - start.height, start.y + dy)),
            width: start.width,
            height: start.height,
          }
        } else {
          // Resize from one of 4 corners
          let newX = start.x, newY = start.y, newW = start.width, newH = start.height
          if (dragMode.includes('nw')) { newX = start.x + dx; newY = start.y + dy; newW = start.width - dx; newH = start.height - dy }
          if (dragMode.includes('ne')) { newY = start.y + dy; newW = start.width + dx; newH = start.height - dy }
          if (dragMode.includes('sw')) { newX = start.x + dx; newW = start.width - dx; newH = start.height + dy }
          if (dragMode.includes('se')) { newW = start.width + dx; newH = start.height + dy }
          // Min size 20
          if (newW < 20) { newW = 20; if (dragMode.includes('nw') || dragMode.includes('sw')) newX = start.x + start.width - 20 }
          if (newH < 20) { newH = 20; if (dragMode.includes('nw') || dragMode.includes('ne')) newY = start.y + start.height - 20 }
          // Clamp to photo bounds
          newX = Math.max(0, newX)
          newY = Math.max(0, newY)
          if (newX + newW > selectedProduct.photoWidth) newW = selectedProduct.photoWidth - newX
          if (newY + newH > selectedProduct.photoHeight) newH = selectedProduct.photoHeight - newY
          newRect = { x: newX, y: newY, width: newW, height: newH }
        }
        setMaskRect(newRect)
      } else if (isPanning && panStart) {
        const dx = e.clientX - panStart.x
        const dy = e.clientY - panStart.y
        setPanX(panStart.panX + dx)
        setPanY(panStart.panY + dy)
      }
    }

    const handleUp = () => {
      setDragMode('none')
      setDragStart(null)
      setIsPanning(false)
      setPanStart(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragMode, dragStart, isPanning, panStart, screenToPhoto, selectedProduct])

  // ★ Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.001
    const newZoom = Math.max(1, Math.min(4, zoom + delta * zoom))
    setZoom(newZoom)
  }, [zoom])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-indigo-600" />
          {t('Fabric Studio', 'ফ্যাব্রিক স্টুডিও')}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('Real photos · Scroll to zoom · Drag mask to adjust fabric area · Drag background to pan', 'বাস্তব ছবি · জুম করতে স্ক্রল করুন · ফ্যাব্রিক এলাকা ঠিক করতে মাস্ক টানুন · প্যান করতে ব্যাকগ্রাউন্ড টানুন')}
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Maximize2 className="w-4 h-4" />
                {t(selectedProduct.nameEn, selectedProduct.nameBn)}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(1, z - 0.3))} title={t('Zoom out', 'জুম আউট')}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono text-muted-foreground px-2">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(4, z + 0.3))} title={t('Zoom in', 'জুম ইন')}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetView} title={t('Reset view', 'ভিউ রিসেট')}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant={showMask ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowMask(!showMask)}
                  title={t('Show/hide mask', 'মাস্ক দেখান/লুকান')}
                >
                  {showMask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t(selectedProduct.descEn, selectedProduct.descBn)}</p>
          </CardHeader>
          <CardContent>
            <div
              ref={containerRef}
              className="rounded-xl overflow-hidden relative bg-slate-200 select-none"
              style={{
                aspectRatio: `${selectedProduct.photoWidth} / ${selectedProduct.photoHeight}`,
                cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
              }}
              onWheel={handleWheel}
              onMouseDown={handleContainerMouseDown}
            >
              {/* Pan surface (transparent layer that catches drag for panning) */}
              <div
                data-role="pan-surface"
                className="absolute inset-0"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              >
                {/* The real product photo as background */}
                <img
                  src={selectedProduct.photoUrl}
                  alt={selectedProduct.nameEn}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />

                {/* SVG overlay with fabric pattern inside the mask rect */}
                <svg
                  viewBox={`0 0 ${selectedProduct.photoWidth} ${selectedProduct.photoHeight}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                >
                  <defs>
                    {selectedFabric && (
                      <pattern
                        id="fabric-pattern-overlay"
                        patternUnits="userSpaceOnUse"
                        width={Math.max(10, selectedProduct.photoWidth * (fabricScale / 100) / 8)}
                        height={Math.max(10, selectedProduct.photoWidth * (fabricScale / 100) / 8)}
                      >
                        <image
                          href={selectedFabric.url}
                          x="0"
                          y="0"
                          width={Math.max(10, selectedProduct.photoWidth * (fabricScale / 100) / 8)}
                          height={Math.max(10, selectedProduct.photoWidth * (fabricScale / 100) / 8)}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </pattern>
                    )}
                    <clipPath id="fabric-clip">
                      <rect x={maskRect.x} y={maskRect.y} width={maskRect.width} height={maskRect.height} rx="8" ry="8" />
                    </clipPath>
                  </defs>

                  {/* Fabric-filled rect clipped to mask */}
                  {selectedFabric && (
                    <rect
                      x={maskRect.x}
                      y={maskRect.y}
                      width={maskRect.width}
                      height={maskRect.height}
                      rx="8"
                      ry="8"
                      fill="url(#fabric-pattern-overlay)"
                      opacity={fabricOpacity / 100}
                      clipPath="url(#fabric-clip)"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                  )}

                  {/* Mask outline (visible when showMask=true) */}
                  {showMask && (
                    <g style={{ pointerEvents: 'auto' }}>
                      <rect
                        x={maskRect.x}
                        y={maskRect.y}
                        width={maskRect.width}
                        height={maskRect.height}
                        rx="8"
                        ry="8"
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth={3 / zoom}
                        strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                        style={{ cursor: dragMode === 'move' ? 'grabbing' : 'grab', pointerEvents: 'stroke' }}
                        onMouseDown={(e) => handleMaskMouseDown(e, 'move')}
                      />
                      {/* 4 resize handles at corners */}
                      {([
                        { x: maskRect.x, y: maskRect.y, mode: 'resize-nw' as const, cursor: 'nwse-resize' },
                        { x: maskRect.x + maskRect.width, y: maskRect.y, mode: 'resize-ne' as const, cursor: 'nesw-resize' },
                        { x: maskRect.x, y: maskRect.y + maskRect.height, mode: 'resize-sw' as const, cursor: 'nesw-resize' },
                        { x: maskRect.x + maskRect.width, y: maskRect.y + maskRect.height, mode: 'resize-se' as const, cursor: 'nwse-resize' },
                      ]).map((h, i) => (
                        <circle
                          key={i}
                          cx={h.x}
                          cy={h.y}
                          r={10 / zoom}
                          fill="#6366f1"
                          stroke="#ffffff"
                          strokeWidth={2 / zoom}
                          style={{ cursor: h.cursor, pointerEvents: 'all' }}
                          onMouseDown={(e) => handleMaskMouseDown(e, h.mode)}
                        />
                      ))}
                    </g>
                  )}
                </svg>
              </div>

              {/* Hint badge */}
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1.5 rounded-md text-[11px] text-slate-700 shadow-sm pointer-events-none">
                <span className="flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  {zoom > 1
                    ? t('Drag to pan · Scroll to zoom', 'প্যান করতে টানুন · জুম করতে স্ক্রল করুন')
                    : t('Scroll to zoom · Drag mask to adjust', 'জুম করতে স্ক্রল করুন · মাস্ক ঠিক করতে টানুন')}
                </span>
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
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Opacity', 'অপাসিটি')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricOpacity}%</span>
                  </div>
                  <Slider value={[fabricOpacity]} min={20} max={100} step={5} onValueChange={v => setFabricOpacity(v[0])} />
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={handleResetAll}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {t('Reset All', 'সব রিসেট')}
                </Button>
              </div>
            )}

            {/* Mask help */}
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-xs text-indigo-800 leading-relaxed">
                <strong>{t('💡 Tip:', '💡 টিপ:')}</strong>{' '}
                {t('Drag the blue mask box to position it over the sofa. Drag corners to resize. Use the eye icon to hide the mask.', 'ব্লু মাস্ক বক্স টেনে সোফার উপর স্থাপন করুন। কোণা টেনে আকার পরিবর্তন করুন। চোখের আইকন দিয়ে মাস্ক লুকান।')}
              </p>
            </div>

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
