'use client'

/**
 * ★ Fabric Studio — Real 3D GLB Models
 * -------------------------------------------------------------
 * Loads REAL 3D couch models from GLB files. Multiple products can
 * be added to the PRODUCTS array below — each one shows up in the
 * gallery and customer can pick any.
 *
 * The customer can:
 *   - Pick from multiple 3D products (gallery at top)
 *   - Rotate the model 360° (drag)
 *   - Zoom in/out (scroll wheel)
 *   - Pan (right-click drag)
 *   - Upload fabric → applied to ALL meshes in the model as a tiled
 *     texture (auto-repeat)
 *   - Adjust fabric scale
 *   - Place Order
 *
 * ────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW 3D MODEL:
 * ────────────────────────────────────────────────────────────────────
 *   1. Convert your FBX to GLB using the helper script:
 *        ./scripts/convert-fbx-to-glb.sh input.fbx output.glb
 *   2. Copy the .glb to /public/fabric-studio/
 *   3. Add a new entry to the PRODUCTS array below:
 *        {
 *          id: 'unique-id',
 *          nameEn: 'Display Name',
 *          nameBn: 'বাংলা নাম',
 *          descEn: 'English description',
 *          descBn: 'বাংলা বর্ণনা',
 *          glbUrl: '/fabric-studio/filename.glb',
 *        }
 *   4. Commit + push. Done!
 *
 * Each product gets auto-preloaded on first load (drei useGLTF.preload).
 */

import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useLoader, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Html, useProgress, Environment, ContactShadows, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useLanguage } from '@/lib/i18n'
import { Upload, ShoppingCart, RotateCcw, Wand2, Check, X, Maximize2, Move3d, Sofa } from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────
// ★ Product catalog — ADD NEW 3D MODELS HERE
// ────────────────────────────────────────────────────────────────────────
// To add a new model: drop a .glb in /public/fabric-studio/ and add
// an entry below. That's it — no other code changes needed.

interface ProductDef {
  id: string
  nameEn: string
  nameBn: string
  descEn: string
  descBn: string
  /** Path to the .glb file inside /public/ */
  glbUrl: string
  /** Optional scale multiplier (default 1.5) — adjust if model is too big/small */
  scale?: number
  /** Optional position offset [x, y, z] (default [0, -0.7, 0]) */
  position?: [number, number, number]
}

const PRODUCTS: ProductDef[] = [
  {
    id: 'couch',
    nameEn: 'Couch',
    nameBn: 'কাউচ',
    descEn: '3-seater couch with cushions, backrest, and armrests',
    descBn: 'কুশন, ব্যাকরেস্ট ও আর্মরেস্ট সহ ৩-সিটার কাউচ',
    glbUrl: '/fabric-studio/couch.glb',
    scale: 1.5,
    position: [0, -0.7, 0],
  },
  {
    id: 'sofa-2',
    nameEn: 'Modern Sofa',
    nameBn: 'মডার্ন সোফা',
    descEn: 'Stylish modern sofa with cushions and detailed fabric texture',
    descBn: 'কুশন ও বিস্তারিত ফ্যাব্রিক টেক্সচার সহ স্টাইলিশ মডার্ন সোফা',
    glbUrl: '/fabric-studio/sofa-2.glb',
    scale: 3.0,
    position: [0, -0.5, 0],
  },
  // ★ ADD MORE MODELS HERE ★
  // Example template:
  // {
  //   id: 'armchair',
  //   nameEn: 'Armchair',
  //   nameBn: 'আর্মচেয়ার',
  //   descEn: 'Single-seater armchair',
  //   descBn: 'সিঙ্গেল-সিটার আর্মচেয়ার',
  //   glbUrl: '/fabric-studio/armchair.glb',
  //   scale: 1.5,
  //   position: [0, -0.7, 0],
  // },
]

// Preload all model URLs so they cache on first visit
PRODUCTS.forEach(p => useGLTF.preload(p.glbUrl))

// ★ Set up Draco decoder for compressed GLB files
// Some models (like sofa-2.glb) are Draco-compressed for smaller file size.
// We configure the global GLTFLoader (which useGLTF uses internally) to use
// a Draco decoder hosted on a CDN. Without this, Draco-compressed models
// would fail to load.
useGLTF.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')

// ────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────

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
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23fdf6e3'/><g fill='%23d97706' opacity='0.85'><circle cx='40' cy='40' r='13'/><circle cx='140' cy='60' r='13'/><circle cx='80' cy='120' r='13'/><circle cx='170' cy='150' r='13'/><circle cx='30' cy='170' r='13'/></g></svg>`),
  },
  {
    id: 'preset-stripes',
    nameEn: 'Navy Stripes',
    nameBn: 'নেভি স্ট্রাইপ',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%231e3a8a'/><g fill='%23ffffff'><rect x='0' y='0' width='25' height='200'/><rect x='50' y='0' width='25' height='200'/><rect x='100' y='0' width='25' height='200'/><rect x='150' y='0' width='25' height='200'/></g></svg>`),
  },
  {
    id: 'preset-velvet',
    nameEn: 'Burgundy Velvet',
    nameBn: 'বারগান্ডি ভেলভেট',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><radialGradient id='v' cx='50%' cy='50%' r='70%'><stop offset='0%' stop-color='%237f1d1d'/><stop offset='100%' stop-color='%23450a0a'/></radialGradient></defs><rect width='200' height='200' fill='url(%23v)'/></svg>`),
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
  {
    id: 'preset-linen',
    nameEn: 'Natural Linen',
    nameBn: 'ন্যাচারাল লিনেন',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23e7e5e4'/></svg>`),
  },
]

// ────────────────────────────────────────────────────────────────────────
// Generic GLB Model component — works for any product in the catalog
// ────────────────────────────────────────────────────────────────────────

interface GLBModelProps {
  glbUrl: string
  scale?: number
  position?: [number, number, number]
  fabricUrl: string | null
  fabricRepeat: number
}

function GLBModel({ glbUrl, scale = 1.5, position = [0, -0.7, 0], fabricUrl, fabricRepeat }: GLBModelProps) {
  // Load the GLB model
  const { scene } = useGLTF(glbUrl)

  // Clone the scene so we don't mutate the cached original
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  // ★ Load fabric texture using useTexture (Suspense-based, handles async properly)
  // useTexture suspends until the image is fully loaded.
  const loadedTexture = useTexture(fabricUrl || '/fabric-studio/transparent-pixel.png')

  // ★ Configure texture settings SYNCHRONOUSLY before applying to any material.
  // This is critical — if we set colorSpace AFTER creating the material, the
  // renderer caches the texture with the wrong color space and colors look washed
  // out or wrong.
  useMemo(() => {
    loadedTexture.wrapS = loadedTexture.wrapT = THREE.RepeatWrapping
    loadedTexture.repeat.set(fabricRepeat, fabricRepeat)
    loadedTexture.colorSpace = THREE.SRGBColorSpace
    loadedTexture.anisotropy = 8
    // ★ flipY = true (default) keeps the texture upright as authored.
    loadedTexture.flipY = true
    loadedTexture.needsUpdate = true
    return loadedTexture
  }, [loadedTexture, fabricRepeat])

  // ★ Generate UVs ONLY for meshes that have NO uv attribute at all.
  // We do NOT overwrite existing UVs — the FBX model's UVs should be respected.
  // Only meshes missing UVs entirely (rare) get fallback planar UVs from
  // bounding-box XY coordinates.
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const geometry = mesh.geometry as THREE.BufferGeometry
        const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
        if (!uvAttr || uvAttr.count === 0) {
          console.log(`[FabricStudio] Mesh "${mesh.name}" has no UVs — generating planar fallback`)
          geometry.computeBoundingBox()
          const bbox = geometry.boundingBox!
          const size = new THREE.Vector3()
          bbox.getSize(size)
          // Avoid divide-by-zero
          const sx = size.x || 1
          const sy = size.y || 1
          const positions = geometry.attributes.position
          const uvs = new Float32Array(positions.count * 2)
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i)
            const y = positions.getY(i)
            uvs[i * 2] = (x - bbox.min.x) / sx
            uvs[i * 2 + 1] = (y - bbox.min.y) / sy
          }
          geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        } else {
          console.log(`[FabricStudio] Mesh "${mesh.name}" has ${uvAttr.count} UVs — keeping original`)
        }
      }
    })
  }, [clonedScene])

  // ★ Apply fabric texture (or default material) to all meshes.
  // Key things done right here:
  //   1. Force loadedTexture.needsUpdate = true before creating material
  //   2. Use color = white (0xffffff) so texture colors show TRUE — no tint
  //   3. Set mat.needsUpdate = true after creating material
  //   4. Use console.log to verify what's being applied
  useEffect(() => {
    // Force texture refresh in case settings changed
    loadedTexture.needsUpdate = true

    let meshCount = 0
    let fabricMeshCount = 0
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        meshCount++
        if (fabricUrl) {
          // ★ Fabric is selected — apply texture
          fabricMeshCount++
          const mat = new THREE.MeshPhysicalMaterial({
            map: loadedTexture,
            color: 0xffffff, // pure white so texture colors show true
            roughness: 0.92,
            metalness: 0.0,
            sheen: 0.5,
            sheenRoughness: 0.5,
            sheenColor: new THREE.Color('#ffffff'),
            side: THREE.DoubleSide,
          })
          mat.needsUpdate = true
          mesh.material = mat
          // Also force the geometry to refresh
          mesh.geometry.attributes.uv && (mesh.geometry.attributes.uv.needsUpdate = true)
        } else {
          // No fabric — default warm beige fabric look
          mesh.material = new THREE.MeshPhysicalMaterial({
            color: '#c9b896',
            roughness: 0.85,
            metalness: 0.0,
            sheen: 0.5,
            sheenRoughness: 0.6,
            sheenColor: new THREE.Color('#fff5e0'),
            side: THREE.DoubleSide,
          })
        }
      }
    })
    console.log(`[FabricStudio] Applied material to ${meshCount} meshes. Fabric applied to ${fabricMeshCount}. fabricUrl=${fabricUrl ? fabricUrl.substring(0, 60) + '...' : 'null'}`)
  }, [clonedScene, loadedTexture, fabricUrl])

  // Scale + position the model nicely in view
  return (
    <group position={position} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  )
}

// ────────────────────────────────────────────────────────────────────────
// 3D Scene
// ────────────────────────────────────────────────────────────────────────

function Scene({
  product,
  fabricUrl,
  fabricRepeat,
}: {
  product: ProductDef
  fabricUrl: string | null
  fabricRepeat: number
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[3.5, 2, 4]} fov={40} />

      {/* Studio lighting — 3-point setup */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[6, 8, 5]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-6, 5, -3]} intensity={0.7} color="#dfe7f5" />
      <directionalLight position={[0, 4, -6]} intensity={0.6} color="#ffffff" />

      <Suspense fallback={
        <Html center>
          <div className="bg-white/90 backdrop-blur px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-slate-700">
            Loading 3D model...
          </div>
        </Html>
      }>
        <GLBModel
          glbUrl={product.glbUrl}
          scale={product.scale}
          position={product.position}
          fabricUrl={fabricUrl}
          fabricRepeat={fabricRepeat}
        />
      </Suspense>

      {/* Soft contact shadow */}
      <ContactShadows
        position={[0, -0.71, 0]}
        opacity={0.6}
        scale={12}
        blur={3}
        far={5}
        resolution={1024}
        color="#0a0a0a"
      />

      {/* Subtle floor plane */}
      <mesh position={[0, -0.72, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color="#eceae5" roughness={0.75} metalness={0.0} />
      </mesh>

      {/* OrbitControls — left-drag rotate, wheel zoom, right-drag pan */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.2, 0]}
        makeDefault
      />

      {/* Studio HDRI for nice reflections */}
      <Environment preset="studio" background={false} />
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────

interface RealGLBFabricStudioProps {
  onPlaceOrder?: (product: ProductDef, fabric: FabricDef | null) => void
}

export default function RealGLBFabricStudio({ onPlaceOrder }: RealGLBFabricStudioProps) {
  const { t } = useLanguage()
  const [selectedProductId, setSelectedProductId] = useState<string>(PRODUCTS[0].id)
  const [fabrics, setFabrics] = useState<FabricDef[]>(PRESET_FABRICS)
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null)
  const [fabricRepeat, setFabricRepeat] = useState<number>(2)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dfcl-fabric-studio-glb-uploads')
      if (saved) {
        const parsed: FabricDef[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFabrics(prev => [...parsed, ...prev])
        }
      }
    } catch {}
  }, [])

  const persistUploads = (uploads: FabricDef[]) => {
    try { localStorage.setItem('dfcl-fabric-studio-glb-uploads', JSON.stringify(uploads)) } catch {}
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

  const handleReset = () => setFabricRepeat(2)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-indigo-600" />
          {t('Fabric Studio (Real 3D)', 'ফ্যাব্রিক স্টুডিও (রিয়েল 3D)')}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
          <Move3d className="w-3.5 h-3.5" />
          {t('Drag to rotate 360° · Scroll to zoom · Right-drag to pan', 'ঘোরাতে টানুন ৩৬০° · জুম করতে স্ক্রল করুন · প্যান করতে রাইট-ক্লিক টানুন')}
        </p>
      </div>

      {/* ★ Product gallery — pick from multiple 3D models */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {PRODUCTS.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProductId(p.id)}
            className={`shrink-0 w-44 rounded-xl overflow-hidden border-2 bg-white transition-all text-left ${selectedProductId === p.id ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}
          >
            <div className="aspect-[4/3] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f1f5f9, #cbd5e1)' }}>
              <Sofa className="w-12 h-12 text-slate-500" strokeWidth={1.2} />
            </div>
            <div className="p-2 border-t border-slate-100">
              <p className="text-xs font-medium text-foreground truncate">{t(p.nameEn, p.nameBn)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Main preview + fabric controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 3D Preview area */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              {t(selectedProduct.nameEn, selectedProduct.nameBn)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t(selectedProduct.descEn, selectedProduct.descBn)}</p>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(180deg, #f5f6f8 0%, #e2e5ea 60%, #c9cdd4 100%)',
                minHeight: '500px',
              }}
            >
              <Canvas
                shadows
                dpr={[1, 2]}
                gl={{
                  antialias: true,
                  preserveDrawingBuffer: true,
                  toneMapping: 2,
                  toneMappingExposure: 1.0,
                }}
                style={{ width: '100%', height: '500px', cursor: 'grab' }}
              >
                <Scene
                  product={selectedProduct}
                  fabricUrl={selectedFabric?.url || null}
                  fabricRepeat={fabricRepeat}
                />
              </Canvas>
              <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur px-2.5 py-1.5 rounded-md text-[11px] text-slate-700 shadow-sm pointer-events-none">
                <span className="flex items-center gap-1">
                  <Move3d className="w-3 h-3" />
                  {t('Drag to rotate · Scroll to zoom', 'ঘোরাতে টানুন · জুম করতে স্ক্রল করুন')}
                </span>
              </div>
            </div>
            {selectedFabric && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {t('Fabric:', 'ফ্যাব্রিক:')} <span className="font-medium text-foreground">{t(selectedFabric.nameEn, selectedFabric.nameBn)}</span>
                {' · '}{t('Repeat:', 'রিপিট:')} {fabricRepeat}×{fabricRepeat}
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
                {t('JPG / PNG / WebP up to 5 MB · auto-repeats on the 3D model', 'JPG / PNG / WebP — ৫ মেগাবাইট পর্যন্ত · 3D মডেলে অটো-রিপিট হবে')}
              </p>
            </div>

            {/* Fabric gallery */}
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

            {/* Pattern repeat slider */}
            {selectedFabric && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Pattern Repeat', 'প্যাটার্ন রিপিট')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricRepeat}×{fabricRepeat}</span>
                  </div>
                  <Slider value={[fabricRepeat]} min={1} max={12} step={1} onValueChange={v => setFabricRepeat(v[0])} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t('Higher = smaller pattern (more repeats)', 'বেশি = ছোট প্যাটার্ন (বেশি রিপিট)')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {t('Reset', 'রিসেট')}
                </Button>
              </div>
            )}

            {/* Help card */}
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-xs text-indigo-800 leading-relaxed">
                <strong>{t('💡 Real 3D Model:', '💡 রিয়েল 3D মডেল:')}</strong>{' '}
                {t('True 3D mesh — drag to rotate 360°, scroll to zoom. Upload a fabric and it auto-repeats across the entire model.', 'সত্যিকারের 3D মেশ — ঘোরাতে টানুন ৩৬০°, জুম করতে স্ক্রল করুন। একটি ফ্যাব্রিক আপলোড করুন এবং এটি পুরো মডেল জুড়ে অটো-রিপিট হবে।')}
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
