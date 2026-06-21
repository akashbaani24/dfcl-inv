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
import { Upload, ShoppingCart, RotateCcw, Wand2, Check, X, Maximize2, Move3d, Sofa, RotateCw, Camera } from 'lucide-react'

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
  {
    id: 'sofa-3',
    nameEn: 'Elegant Sofa',
    nameBn: 'এলিগ্যান্ট সোফা',
    descEn: 'Elegant single-mesh sofa with detailed fabric texture',
    descBn: 'বিস্তারিত ফ্যাব্রিক টেক্সচার সহ এলিগ্যান্ট সিঙ্গেল-মেশ সোফা',
    glbUrl: '/fabric-studio/sofa-3.glb',
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
  bodyFabricUrl: string | null
  cushionFabricUrl: string | null
  fabricRepeat: number
}

// ★ Mesh name patterns that identify cushion/pillow meshes.
// If a mesh's node name (lower-cased) contains any of these substrings, it gets
// the cushion fabric; otherwise it gets the body fabric.
// Patterns cover: Spanish (cojin = cushion), English (cushion/pillow),
// common model naming conventions.
const CUSHION_NAME_PATTERNS = [
  'cojin',       // Spanish: cushion
  'cushion',     // English: cushion
  'pillow',      // English: pillow
  'cuadro',      // Spanish: square (sometimes used for cushions)
  'sofa-cojin',  // specific to user's couch model
]

function isCushionMesh(meshName: string): boolean {
  const lower = meshName.toLowerCase()
  return CUSHION_NAME_PATTERNS.some(p => lower.includes(p))
}

function GLBModel({ glbUrl, scale = 1.5, position = [0, -0.7, 0], bodyFabricUrl, cushionFabricUrl, fabricRepeat }: GLBModelProps) {
  // Load the GLB model
  const { scene } = useGLTF(glbUrl)

  // Clone the scene so we don't mutate the cached original
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  // ★ Load BOTH textures via useTexture (Suspense handles async).
  // When the user picks a fabric for body or cushion (or both), we load it.
  // If a slot is null, we use the transparent pixel as a no-op placeholder.
  const bodyTexture = useTexture(bodyFabricUrl || '/fabric-studio/transparent-pixel.png')
  const cushionTexture = useTexture(cushionFabricUrl || '/fabric-studio/transparent-pixel.png')

  // Configure body texture settings
  useMemo(() => {
    bodyTexture.wrapS = bodyTexture.wrapT = THREE.RepeatWrapping
    bodyTexture.repeat.set(fabricRepeat, fabricRepeat)
    bodyTexture.colorSpace = THREE.SRGBColorSpace
    bodyTexture.anisotropy = 8
    bodyTexture.flipY = true
    bodyTexture.needsUpdate = true
    return bodyTexture
  }, [bodyTexture, fabricRepeat])

  // Configure cushion texture settings
  useMemo(() => {
    cushionTexture.wrapS = cushionTexture.wrapT = THREE.RepeatWrapping
    cushionTexture.repeat.set(fabricRepeat, fabricRepeat)
    cushionTexture.colorSpace = THREE.SRGBColorSpace
    cushionTexture.anisotropy = 8
    cushionTexture.flipY = true
    cushionTexture.needsUpdate = true
    return cushionTexture
  }, [cushionTexture, fabricRepeat])

  // ★ Generate UVs ONLY for meshes that have NO uv attribute at all.
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

  // ★ Apply fabric texture to each mesh based on its name.
  // Cushion meshes get cushionFabric, body meshes get bodyFabric.
  // If neither fabric is selected, fall back to default beige.
  useEffect(() => {
    bodyTexture.needsUpdate = true
    cushionTexture.needsUpdate = true

    let meshCount = 0
    let bodyMeshCount = 0
    let cushionMeshCount = 0
    const meshNames: string[] = []
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        meshCount++

        // ★ Use child.name (the node name from FBX/GLB — e.g. "sofa-cojin", "espaldar sofa")
        // NOT mesh.geometry.name (which is auto-generated like "Plane.004")
        const nodeName = child.name || ''
        const isCushion = isCushionMesh(nodeName)
        if (isCushion) {
          cushionMeshCount++
          meshNames.push(`  [CUSHION] "${nodeName}"`)
        } else {
          bodyMeshCount++
          meshNames.push(`  [BODY]    "${nodeName}"`)
        }

        // Pick which fabric applies to this mesh
        const fabricForThisMesh = isCushion ? cushionFabricUrl : bodyFabricUrl
        const textureForThisMesh = isCushion ? cushionTexture : bodyTexture

        if (fabricForThisMesh) {
          // Apply fabric texture
          const mat = new THREE.MeshPhysicalMaterial({
            map: textureForThisMesh,
            color: 0xffffff,
            roughness: 0.92,
            metalness: 0.0,
            sheen: 0.5,
            sheenRoughness: 0.5,
            sheenColor: new THREE.Color('#ffffff'),
            side: THREE.DoubleSide,
          })
          mat.needsUpdate = true
          mesh.material = mat
          mesh.geometry.attributes.uv && (mesh.geometry.attributes.uv.needsUpdate = true)
        } else {
          // No fabric for this slot — default warm beige fabric look
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
    console.log(`[FabricStudio] ${meshCount} meshes: ${bodyMeshCount} body + ${cushionMeshCount} cushion. body=${bodyFabricUrl ? 'set' : 'null'}, cushion=${cushionFabricUrl ? 'set' : 'null'}\n${meshNames.join('\n')}`)
  }, [clonedScene, bodyTexture, cushionTexture, bodyFabricUrl, cushionFabricUrl])

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
  bodyFabricUrl,
  cushionFabricUrl,
  fabricRepeat,
  autoRotate,
  bgColor,
  floorColor,
}: {
  product: ProductDef
  bodyFabricUrl: string | null
  cushionFabricUrl: string | null
  fabricRepeat: number
  autoRotate: boolean
  bgColor: string
  floorColor: string
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
          bodyFabricUrl={bodyFabricUrl}
          cushionFabricUrl={cushionFabricUrl}
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

      {/* ★ Floor plane — uses floorColor (separate from bgColor) */}
      <mesh position={[0, -0.72, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color={floorColor} roughness={0.75} metalness={0.0} />
      </mesh>

      {/* OrbitControls — left-drag rotate, wheel zoom, right-drag pan
          ★ autoRotate makes the model slowly spin like a product showcase
          when the customer isn't interacting */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.2, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={1.5}
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
  // ★ Two separate fabric selections — body and cushion
  const [bodyFabricId, setBodyFabricId] = useState<string | null>(null)
  const [cushionFabricId, setCushionFabricId] = useState<string | null>(null)
  const [fabricRepeat, setFabricRepeat] = useState<number>(2)
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  // ★ Background color (the sky/wall area) and Floor color (the ground plane)
  // — separate so the customer can create a more realistic scene.
  const [bgColor, setBgColor] = useState<string>('#eceae5')
  const [floorColor, setFloorColor] = useState<string>('#d4cfc4')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // ★ Canvas ref for Save Design screenshot
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  // ★ Use a ref (not state) for upload target — avoids race condition where
  // the state hasn't updated by the time fileInputRef.current?.click() fires.
  // Refs are synchronous so the value is set BEFORE the click happens.
  const uploadTargetRef = useRef<'body' | 'cushion'>('body')

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

  const bodyFabric = useMemo(
    () => fabrics.find(f => f.id === bodyFabricId) || null,
    [fabrics, bodyFabricId]
  )
  const cushionFabric = useMemo(
    () => fabrics.find(f => f.id === cushionFabricId) || null,
    [fabrics, cushionFabricId]
  )

  // ★ handleUpload uses uploadTarget state to decide which slot to fill.
  // The two "Upload Your Fabric" buttons set uploadTarget before clicking
  // the hidden file input.
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
      // Apply to whichever slot is the current upload target (ref-based, synchronous)
      if (uploadTargetRef.current === 'cushion') {
        setCushionFabricId(newFabric.id)
      } else {
        setBodyFabricId(newFabric.id)
      }
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
    if (bodyFabricId === id) setBodyFabricId(null)
    if (cushionFabricId === id) setCushionFabricId(null)
  }

  const handleReset = () => setFabricRepeat(2)

  // ★ Save Design — captures the current 3D view as a PNG image and downloads it.
  // The Canvas was created with preserveDrawingBuffer: true, so we can read its
  // pixels via toDataURL. Customer can save their fabric+sofa combo to share
  // with family, send to the shop, or post on social media.
  const handleSaveDesign = () => {
    const container = canvasContainerRef.current
    if (!container) return
    const canvas = container.querySelector('canvas')
    if (!canvas) {
      alert(t('3D view not ready yet — please wait a moment and try again', '3D ভিউ এখনও প্রস্তুত নয় — একটু পরে আবার চেষ্টা করুন'))
      return
    }
    try {
      // Force a render before capturing (in case autoRotate is off and nothing
      // has triggered a redraw recently)
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      const productSlug = selectedProduct.id
      const bodySlug = bodyFabric ? bodyFabric.id : 'no-body-fabric'
      const cushionSlug = cushionFabric ? cushionFabric.id : 'no-cushion-fabric'
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      link.download = `fabric-studio-${productSlug}-${bodySlug}-${cushionSlug}-${timestamp}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Save design failed:', err)
      alert(t('Could not save design. Please try again.', 'ডিজাইন সেভ করা যায়নি। আবার চেষ্টা করুন।'))
    }
  }

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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Maximize2 className="w-4 h-4" />
                {t(selectedProduct.nameEn, selectedProduct.nameBn)}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {/* ★ Auto-rotate toggle */}
                <Button
                  variant={autoRotate ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAutoRotate(!autoRotate)}
                  title={autoRotate ? t('Stop auto-rotate', 'অটো-রোটেশন বন্ধ করুন') : t('Start auto-rotate', 'অটো-রোটেশন চালু করুন')}
                  className="h-8"
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                  {t('Auto-rotate', 'অটো-রোটেট')}
                </Button>
                {/* ★ Save Design button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDesign}
                  title={t('Save current view as PNG image', 'বর্তমান ভিউ PNG ছবি হিসেবে সেভ করুন')}
                  className="h-8"
                >
                  <Camera className="w-3.5 h-3.5 mr-1.5" />
                  {t('Save Design', 'ডিজাইন সেভ')}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t(selectedProduct.descEn, selectedProduct.descBn)}</p>
          </CardHeader>
          <CardContent>
            <div
              ref={canvasContainerRef}
              className="rounded-xl overflow-hidden relative"
              style={{
                background: bgColor,
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
                  bodyFabricUrl={bodyFabric?.url || null}
                  cushionFabricUrl={cushionFabric?.url || null}
                  fabricRepeat={fabricRepeat}
                  autoRotate={autoRotate}
                  bgColor={bgColor}
                  floorColor={floorColor}
                />
              </Canvas>
              <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur px-2.5 py-1.5 rounded-md text-[11px] text-slate-700 shadow-sm pointer-events-none">
                <span className="flex items-center gap-1">
                  <Move3d className="w-3 h-3" />
                  {t('Drag to rotate · Scroll to zoom', 'ঘোরাতে টানুন · জুম করতে স্ক্রল করুন')}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {bodyFabric && <>{t('Body:', 'বডি:')} <span className="font-medium text-foreground">{t(bodyFabric.nameEn, bodyFabric.nameBn)}</span>{' · '}</>}
              {cushionFabric && <>{t('Cushion:', 'কুশন:')} <span className="font-medium text-foreground">{t(cushionFabric.nameEn, cushionFabric.nameBn)}</span>{' · '}</>}
              {t('Repeat:', 'রিপিট:')} {fabricRepeat}×{fabricRepeat}
            </p>
          </CardContent>
        </Card>

        {/* Fabric controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('Fabric & Background', 'ফ্যাব্রিক ও ব্যাকগ্রাউন্ড')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />

            {/* ★ Body Fabric section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold text-slate-700">{t('Sofa Body Fabric', 'সোফা বডি ফ্যাব্রিক')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { uploadTargetRef.current = 'body'; fileInputRef.current?.click() }}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {t('Upload', 'আপলোড')}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {fabrics.map(f => (
                  <button
                    key={`body-${f.id}`}
                    onClick={() => setBodyFabricId(bodyFabricId === f.id ? null : f.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${bodyFabricId === f.id ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-400'}`}
                    title={t(f.nameEn, f.nameBn)}
                  >
                    <img src={f.url} alt={f.nameEn} className="w-full h-full object-cover" />
                    {bodyFabricId === f.id && (
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

            {/* ★ Cushion Fabric section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold text-slate-700">{t('Cushion Fabric', 'কুশন ফ্যাব্রিক')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { uploadTargetRef.current = 'cushion'; fileInputRef.current?.click() }}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {t('Upload', 'আপলোড')}
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {fabrics.map(f => (
                  <button
                    key={`cushion-${f.id}`}
                    onClick={() => setCushionFabricId(cushionFabricId === f.id ? null : f.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${cushionFabricId === f.id ? 'border-emerald-600 ring-2 ring-emerald-200' : 'border-slate-200 hover:border-slate-400'}`}
                    title={t(f.nameEn, f.nameBn)}
                  >
                    <img src={f.url} alt={f.nameEn} className="w-full h-full object-cover" />
                    {cushionFabricId === f.id && (
                      <span className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
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
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('Note: cushion fabric only applies to models with separately-named cushion meshes (like the Couch). Single-mesh sofas will use body fabric only.', 'নোট: কুশন ফ্যাব্রিক শুধুমাত্র আলাদা কুশন মেশ সহ মডেলে (যেমন কাউচ) প্রযোজ্য। সিঙ্গেল-মেশ সোফায় শুধু বডি ফ্যাব্রিক ব্যবহৃত হবে।')}
              </p>
            </div>

            {/* ★ Background Color section */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">{t('Background Color', 'ব্যাকগ্রাউন্ড কালার')}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-slate-200 cursor-pointer bg-white p-1"
                    title={t('Pick background color', 'ব্যাকগ্রাউন্ড কালার বাছুন')}
                  />
                  <Input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="font-mono text-sm h-10 w-28"
                    placeholder="#eceae5"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {/* Quick color presets — 12 options */}
                  {[
                    { name: 'Light Gray', color: '#eceae5' },
                    { name: 'White', color: '#ffffff' },
                    { name: 'Cream', color: '#f5f0e6' },
                    { name: 'Beige', color: '#e8dcc0' },
                    { name: 'Soft Pink', color: '#f3d9d9' },
                    { name: 'Soft Yellow', color: '#f5ecc7' },
                    { name: 'Soft Blue', color: '#d6e3f0' },
                    { name: 'Soft Green', color: '#d4e8d4' },
                    { name: 'Navy Blue', color: '#1e3a5f' },
                    { name: 'Forest Green', color: '#2d4a3e' },
                    { name: 'Dark Gray', color: '#3a3a3a' },
                    { name: 'Black', color: '#1a1a1a' },
                  ].map(c => (
                    <button
                      key={c.color}
                      onClick={() => setBgColor(c.color)}
                      className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${bgColor.toLowerCase() === c.color.toLowerCase() ? 'border-indigo-600 ring-1 ring-indigo-300' : 'border-slate-200'}`}
                      style={{ background: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">{t('Floor Color', 'ফ্লোর কালার')}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={floorColor}
                    onChange={(e) => setFloorColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-slate-200 cursor-pointer bg-white p-1"
                    title={t('Pick floor color', 'ফ্লোর কালার বাছুন')}
                  />
                  <Input
                    type="text"
                    value={floorColor}
                    onChange={(e) => setFloorColor(e.target.value)}
                    className="font-mono text-sm h-10 w-28"
                    placeholder="#d4cfc4"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {/* Floor color presets — 8 wood/concrete tones */}
                  {[
                    { name: 'Concrete', color: '#d4cfc4' },
                    { name: 'Light Oak', color: '#d4b896' },
                    { name: 'Walnut', color: '#8b6f47' },
                    { name: 'Dark Walnut', color: '#5d4037' },
                    { name: 'Cherry', color: '#8b4513' },
                    { name: 'Maple', color: '#e6d5b8' },
                    { name: 'White Marble', color: '#f0f0f0' },
                    { name: 'Black Tile', color: '#2a2a2a' },
                  ].map(c => (
                    <button
                      key={c.color}
                      onClick={() => setFloorColor(c.color)}
                      className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${floorColor.toLowerCase() === c.color.toLowerCase() ? 'border-emerald-600 ring-1 ring-emerald-300' : 'border-slate-200'}`}
                      style={{ background: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Pattern repeat slider */}
            {(bodyFabric || cushionFabric) && (
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
                  {t('Reset Repeat', 'রিপিট রিসেট')}
                </Button>
              </div>
            )}

            {/* Place Order */}
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800"
              onClick={() => onPlaceOrder?.(selectedProduct, bodyFabric || cushionFabric)}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('Place Order with This Design', 'এই ডিজাইন দিয়ে অর্ডার করুন')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
