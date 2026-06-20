'use client'

/**
 * ★ 3D Fabric Studio
 * -------------------------------------------------------------
 * Real 3D product visualizer using react-three-fiber (Three.js).
 *
 * Features:
 *   - Customer can ROTATE the sofa (click + drag)
 *   - Customer can ZOOM in/out (scroll wheel)
 *   - Customer can PAN (right-click + drag)
 *   - Uploaded fabric is auto-repeated as a tiled texture on all
 *     fabric surfaces (THREE.RepeatWrapping) so it looks like a
 *     continuous piece of fabric — exactly like the reference photo
 *
 * 3D model: Modern minimalist 2-seater sofa with:
 *   - Boxy seat base (2 cushions)
 *   - Boxy backrest (2 cushions)
 *   - Wide square armrests
 *   - Royal blue accent pillows (1 per seat)
 *   - Short cylindrical metal legs
 *   - Soft studio lighting + neutral gray background (like the ref)
 */

import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useLoader, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Environment, PerspectiveCamera, Html, useProgress, RoundedBox } from '@react-three/drei'
import { EffectComposer, SSAO, Bloom, Vignette, SMAA, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/lib/i18n'
import { Upload, ShoppingCart, RotateCcw, Maximize2, Wand2, Armchair as ArmchairIcon, Check, X, Sofa, ZoomIn, ZoomOut, Move3d, Lightbulb } from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────
// Procedural fabric weave normal map
// ────────────────────────────────────────────────────────────────────────
// Generates a tileable normal map at runtime via canvas that simulates
// the weave pattern of upholstery fabric. This is what gives real fabric
// its visible texture under grazing light — without this, the fabric
// looks like a flat colored surface.
//
// The pattern is a 2x2 twill weave: threads going over/under each other
// in a diagonal pattern, which is what most upholstery fabric looks like
// up close.

function generateFabricNormalMap(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Normal map encoding: RGB = (xyz normal) * 0.5 + 0.5
  // Flat surface = (0, 0, 1) = rgb(128, 128, 255)
  // We'll compute per-pixel normals for a twill weave height field.

  // Build height field (grayscale image) first
  const heights = new Float32Array(size * size)
  const threadWidth = 8 // pixels per thread
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / threadWidth)
      const ty = Math.floor(y / threadWidth)
      const ox = (x % threadWidth) / threadWidth // 0..1 within thread
      const oy = (y % threadWidth) / threadWidth

      // Each thread is a half-sine wave (rounded top)
      const threadH = 0.5 + 0.5 * Math.sin(ox * Math.PI) * Math.sin(oy * Math.PI)

      // Twill: 2x2 over-under pattern
      const over = ((tx + ty) % 2) === 0
      heights[y * size + x] = over ? threadH : 1 - threadH * 0.5
    }
  }

  // Compute normals from height field via Sobel filter
  const imageData = ctx.createImageData(size, size)
  const strength = 1.5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x
      const hL = heights[y * size + ((x - 1 + size) % size)]
      const hR = heights[y * size + ((x + 1) % size)]
      const hD = heights[((y - 1 + size) % size) * size + x]
      const hU = heights[((y + 1) % size) * size + x]
      const dx = (hR - hL) * strength
      const dy = (hU - hD) * strength
      const nx = -dx
      const ny = -dy
      const nz = 1
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      const px = idx * 4
      imageData.data[px] = ((nx / len) * 0.5 + 0.5) * 255
      imageData.data[px + 1] = ((ny / len) * 0.5 + 0.5) * 255
      imageData.data[px + 2] = ((nz / len) * 0.5 + 0.5) * 255
      imageData.data[px + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.NoColorSpace // normal maps are not sRGB
  texture.anisotropy = 8
  return texture
}

// Cache the normal map so it's only generated once per session
let _fabricNormalMap: THREE.Texture | null = null
function getFabricNormalMap(): THREE.Texture {
  if (!_fabricNormalMap) {
    _fabricNormalMap = generateFabricNormalMap()
  }
  return _fabricNormalMap
}

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
  /** Renders the 3D model (a group of meshes) inside the Canvas. */
  render3D: (fabricTexture: THREE.Texture | null) => React.ReactNode
}

interface FabricDef {
  id: string
  nameEn: string
  nameBn: string
  url: string
  uploaded?: boolean
}

// ────────────────────────────────────────────────────────────────────────
// Preset fabrics (data-URL SVGs so they load instantly)
// ────────────────────────────────────────────────────────────────────────

const svgToDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

const PRESET_FABRICS: FabricDef[] = [
  {
    id: 'preset-floral',
    nameEn: 'Floral Cream',
    nameBn: 'ফ্লোরাল ক্রিম',
    url: svgToDataUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23fdf6e3'/><g fill='%23d97706' opacity='0.8'><circle cx='40' cy='40' r='12'/><circle cx='40' cy='40' r='5' fill='%2392400e'/><circle cx='140' cy='60' r='12'/><circle cx='140' cy='60' r='5' fill='%2392400e'/><circle cx='80' cy='120' r='12'/><circle cx='80' cy='120' r='5' fill='%2392400e'/><circle cx='170' cy='150' r='12'/><circle cx='170' cy='150' r='5' fill='%2392400e'/><circle cx='30' cy='170' r='12'/><circle cx='30' cy='170' r='5' fill='%2392400e'/></g></svg>`),
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
]

// ────────────────────────────────────────────────────────────────────────
// Fabric texture loader hook
// ────────────────────────────────────────────────────────────────────────
// Loads a fabric image as a THREE.Texture with RepeatWrapping enabled
// so it tiles automatically when applied to large surfaces (matches
// the user's request: "auto repeat pattern like a big fabric").

function useFabricTexture(url: string | null, repeat: number) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }

    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'
    loader.load(
      url,
      (tex) => {
        // ★ THREE.RepeatWrapping makes the pattern tile automatically
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(repeat, repeat)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8 // sharper at grazing angles
        tex.needsUpdate = true
        setTexture(tex)
      },
      undefined,
      (err) => {
        console.error('Failed to load fabric texture:', err)
        setTexture(null)
      }
    )

    return () => {
      // Cleanup previous texture when URL or repeat changes
    }
  }, [url])

  // Update repeat count without reloading the texture
  useEffect(() => {
    if (texture) {
      texture.repeat.set(repeat, repeat)
      texture.needsUpdate = true
    }
  }, [texture, repeat])

  return texture
}

// ────────────────────────────────────────────────────────────────────────
// 3D Models
// ────────────────────────────────────────────────────────────────────────

// Default fabric material color (neutral gray, like the reference photo)
const DEFAULT_FABRIC_COLOR = '#7a8290'

interface FabricMaterialProps {
  fabricTexture: THREE.Texture | null
  color?: string
}

// ★ Realistic fabric material using meshPhysicalMaterial + procedural normal map.
// - normalMap: procedural twill weave pattern (see generateFabricNormalMap)
// - normalScale: how strong the weave appears
// - sheen: subtle fabric highlight along grazing edges
// - roughness: 0.92 — matte like real upholstery
// - clearcoat: 0 — no plastic shine
// - envMapIntensity: 0.4 — subtle env reflection
// The normal map is the KEY to making the fabric look like real fabric
// instead of a flat colored surface. Without it, even a great material
// setup still looks CG.
function FabricMaterial({ fabricTexture, color = DEFAULT_FABRIC_COLOR }: FabricMaterialProps) {
  const normalMap = useMemo(() => getFabricNormalMap(), [])

  // Make the normal map repeat at a smaller scale so weave is visible up close
  // We can't share a single texture with different repeat counts, so clone.
  const clonedNormal = useMemo(() => {
    const c = normalMap.clone()
    c.needsUpdate = true
    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(8, 8)
    return c
  }, [normalMap])

  if (fabricTexture) {
    return (
      <meshPhysicalMaterial
        map={fabricTexture}
        normalMap={clonedNormal}
        normalScale={new THREE.Vector2(0.6, 0.6)}
        roughness={0.92}
        metalness={0.0}
        sheen={0.8}
        sheenRoughness={0.45}
        sheenColor="#f5f5f0"
        clearcoat={0.0}
        clearcoatRoughness={1.0}
        side={THREE.DoubleSide}
        envMapIntensity={0.5}
      />
    )
  }
  return (
    <meshPhysicalMaterial
      color={color}
      normalMap={clonedNormal}
      normalScale={new THREE.Vector2(0.6, 0.6)}
      roughness={0.92}
      metalness={0.0}
      sheen={0.8}
      sheenRoughness={0.45}
      sheenColor="#f5f5f0"
      clearcoat={0.0}
      clearcoatRoughness={1.0}
      side={THREE.DoubleSide}
      envMapIntensity={0.5}
    />
  )
}

// ★ Polished chrome material for legs — uses high metalness + low roughness
// so the env map reflects clearly, giving a realistic chrome/steel look.
function ChromeMaterial() {
  return (
    <meshStandardMaterial
      color="#9a9a9a"
      roughness={0.15}
      metalness={0.95}
      envMapIntensity={1.6}
    />
  )
}

// ★ Soft pillow material — slightly more sheen than seat fabric, since pillows
// are usually a smoother fabric (like velvet or polished cotton).
function PillowMaterial({ color = '#1e3a8a' }: { color?: string }) {
  const normalMap = useMemo(() => getFabricNormalMap(), [])
  const clonedNormal = useMemo(() => {
    const c = normalMap.clone()
    c.needsUpdate = true
    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(4, 4)
    return c
  }, [normalMap])
  return (
    <meshPhysicalMaterial
      color={color}
      normalMap={clonedNormal}
      normalScale={new THREE.Vector2(0.4, 0.4)}
      roughness={0.55}
      metalness={0.0}
      sheen={0.7}
      sheenRoughness={0.35}
      sheenColor="#6b9eff"
      clearcoat={0.08}
      clearcoatRoughness={0.6}
      envMapIntensity={0.6}
    />
  )
}

// ────────────────────────────────────────────────────────────────────────
// ★ Realistic Puffy Cushion component
// ────────────────────────────────────────────────────────────────────────
// Instead of a RoundedBox (which still has flat sides), we use a
// high-resolution sphere geometry scaled into a cushion shape.
// A flattened sphere naturally has the rounded, puffy, "stuffed" look
// of a real cushion — the top is rounded (not flat), edges curve softly,
// and light catches the curvature beautifully.
//
// Args:
//   size: [width, height, depth] in meters
//   position, rotation: standard transform
//   fabricTexture: passed to FabricMaterial

interface CushionProps {
  size: [number, number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  fabricTexture: THREE.Texture | null
}

function Cushion({ size, position, rotation = [0, 0, 0], fabricTexture }: CushionProps) {
  // scale = how much to squash the sphere to get the cushion shape
  // We create a unit sphere (radius 1) and scale it to match `size`
  return (
    <mesh position={position} rotation={rotation} scale={size} castShadow receiveShadow>
      {/* 64x48 segments = smooth curvature, no visible facets */}
      <sphereGeometry args={[0.5, 64, 48]} />
      <FabricMaterial fabricTexture={fabricTexture} />
    </mesh>
  )
}

// Realistic accent pillow — slightly squished sphere with rotation
// to simulate a leaning pillow on a sofa
interface AccentPillowProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  color?: string
}

function AccentPillow({ position, rotation = [0, 0, 0], color = '#1e3a8a' }: AccentPillowProps) {
  return (
    <mesh position={position} rotation={rotation} scale={[0.55, 0.55, 0.18]} castShadow>
      <sphereGeometry args={[0.5, 48, 32]} />
      <PillowMaterial color={color} />
    </mesh>
  )
}

// Modern 2-seater sofa (matches reference photo #1)
// ★ Photorealistic look achieved via:
//   - Flattened sphere geometry for cushions (puffy, rounded top — not flat box)
//   - Procedural fabric normal map (visible weave under grazing light)
//   - meshPhysicalMaterial with strong sheen (fabric highlight on edges)
//   - 3-point studio lighting + ACES tone mapping + SSAO post-processing
//   - Chrome legs with high envMapIntensity (real reflections)
//   - Soft contact shadow + floor plane for grounding
const ModernSofa: React.FC<{ fabricTexture: THREE.Texture | null }> = ({ fabricTexture }) => {
  return (
    <group position={[0, -0.4, 0]}>
      {/* ─── Seat base (frame) — kept as RoundedBox since it's hidden under cushions ─── */}
      <RoundedBox args={[2.4, 0.32, 1.1]} radius={0.06} smoothness={4} position={[0, 0.35, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>

      {/* ─── Seat cushions (2) — flattened sphere = puffy realistic look ─── */}
      <Cushion size={[1.1, 0.32, 1.0]} position={[-0.58, 0.73, 0.02]} fabricTexture={fabricTexture} />
      <Cushion size={[1.1, 0.32, 1.0]} position={[0.58, 0.73, 0.02]} fabricTexture={fabricTexture} />

      {/* ─── Backrest cushions (2) — tilted slightly back for natural recline ─── */}
      <Cushion size={[1.1, 0.6, 0.24]} position={[-0.58, 1.12, -0.4]} rotation={[-0.08, 0, 0]} fabricTexture={fabricTexture} />
      <Cushion size={[1.1, 0.6, 0.24]} position={[0.58, 1.12, -0.4]} rotation={[-0.08, 0, 0]} fabricTexture={fabricTexture} />

      {/* ─── Armrests (2) — rounded top via RoundedBox (still good for arms) ─── */}
      <RoundedBox args={[0.32, 0.7, 1.1]} radius={0.12} smoothness={6} position={[-1.2, 0.7, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>
      <RoundedBox args={[0.32, 0.7, 1.1]} radius={0.12} smoothness={6} position={[1.2, 0.7, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>

      {/* ─── Accent pillows (royal blue) — squished sphere = realistic pillow ─── */}
      <AccentPillow position={[-0.6, 0.98, 0.18]} rotation={[0.05, 0, 0.08]} />
      <AccentPillow position={[0.6, 0.98, 0.18]} rotation={[0.05, 0, -0.08]} />

      {/* ─── Legs (4 short cylindrical chrome legs) ─── */}
      {[
        [-1.1, -0.45],
        [1.1, -0.45],
        [-1.1, 0.45],
        [1.1, 0.45],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.07, z]}>
          {/* Tapered leg — wider at top, narrower at bottom */}
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.22, 24]} />
            <ChromeMaterial />
          </mesh>
          {/* Small floor pad (felt/nylon tip) */}
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.02, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Armchair (scaled-down version of the sofa)
const Armchair3D: React.FC<{ fabricTexture: THREE.Texture | null }> = ({ fabricTexture }) => {
  return (
    <group position={[0, -0.3, 0]}>
      {/* Seat base */}
      <RoundedBox args={[1.3, 0.32, 1.0]} radius={0.06} smoothness={4} position={[0, 0.35, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>
      {/* Seat cushion — puffy flattened sphere */}
      <Cushion size={[1.1, 0.32, 0.95]} position={[0, 0.73, 0.02]} fabricTexture={fabricTexture} />
      {/* Backrest cushion — tilted slightly back */}
      <Cushion size={[1.1, 0.6, 0.24]} position={[0, 1.12, -0.36]} rotation={[-0.08, 0, 0]} fabricTexture={fabricTexture} />
      {/* Armrests */}
      <RoundedBox args={[0.32, 0.7, 1.0]} radius={0.12} smoothness={6} position={[-0.65, 0.7, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>
      <RoundedBox args={[0.32, 0.7, 1.0]} radius={0.12} smoothness={6} position={[0.65, 0.7, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>
      {/* Accent pillow */}
      <AccentPillow position={[0, 0.98, 0.18]} rotation={[0.05, 0, 0]} />
      {/* Legs — chrome with floor pads */}
      {[[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0.07, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.22, 24]} />
            <ChromeMaterial />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.02, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// 3-seater sofa (extended version)
const Sofa3Seater: React.FC<{ fabricTexture: THREE.Texture | null }> = ({ fabricTexture }) => {
  return (
    <group position={[0, -0.4, 0]}>
      {/* Seat base */}
      <RoundedBox args={[3.4, 0.32, 1.1]} radius={0.06} smoothness={4} position={[0, 0.35, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>
      {/* Seat cushions (3) — puffy flattened sphere */}
      {[-1.05, 0, 1.05].map((x, i) => (
        <Cushion key={i} size={[1.05, 0.32, 1.0]} position={[x, 0.73, 0.02]} fabricTexture={fabricTexture} />
      ))}
      {/* Backrest cushions (3) — tilted slightly back */}
      {[-1.05, 0, 1.05].map((x, i) => (
        <Cushion key={i} size={[1.05, 0.6, 0.24]} position={[x, 1.12, -0.4]} rotation={[-0.08, 0, 0]} fabricTexture={fabricTexture} />
      ))}
      {/* Armrests */}
      <RoundedBox args={[0.32, 0.7, 1.1]} radius={0.12} smoothness={6} position={[-1.7, 0.7, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>
      <RoundedBox args={[0.32, 0.7, 1.1]} radius={0.12} smoothness={6} position={[1.7, 0.7, 0]} castShadow receiveShadow>
        <FabricMaterial fabricTexture={fabricTexture} />
      </RoundedBox>
      {/* Accent pillows (3) — squished sphere, tilted outward */}
      {[-1.05, 0, 1.05].map((x, i) => (
        <AccentPillow key={i} position={[x, 0.98, 0.18]} rotation={[0.05, 0, i === 1 ? 0 : (i === 0 ? 0.08 : -0.08)]} />
      ))}
      {/* Legs — chrome with floor pads */}
      {[[-1.6, -0.45], [1.6, -0.45], [-1.6, 0.45], [1.6, 0.45]].map(([x, z], i) => (
        <group key={i} position={[x, 0.07, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.22, 24]} />
            <ChromeMaterial />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.02, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Office chair (different style: tall backrest, 5-star base, wheels)
// Realistic look: puffy sphere seat + curved backrest, chrome 5-star base,
// polished center pole, dark nylon caster wheels.
const OfficeChair3D: React.FC<{ fabricTexture: THREE.Texture | null }> = ({ fabricTexture }) => {
  return (
    <group position={[0, -0.6, 0]}>
      {/* Seat cushion — puffy flattened sphere */}
      <Cushion size={[0.7, 0.14, 0.7]} position={[0, 0.5, 0]} fabricTexture={fabricTexture} />
      {/* Backrest — curved flattened sphere */}
      <Cushion size={[0.7, 0.85, 0.16]} position={[0, 1.05, -0.32]} rotation={[-0.05, 0, 0]} fabricTexture={fabricTexture} />
      {/* Headrest accent — small puffy cushion */}
      <Cushion size={[0.55, 0.2, 0.12]} position={[0, 1.45, -0.29]} rotation={[-0.15, 0, 0]} fabricTexture={fabricTexture} />
      {/* Center pole — chrome cylinder */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 24]} />
        <ChromeMaterial />
      </mesh>
      {/* 5-star base — chrome arms */}
      {[0, 72, 144, 216, 288].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        return (
          <mesh key={i} position={[Math.cos(rad) * 0.25, 0.05, Math.sin(rad) * 0.25]} rotation={[0, -rad, 0]} castShadow>
            <boxGeometry args={[0.5, 0.06, 0.08]} />
            <ChromeMaterial />
          </mesh>
        )
      })}
      {/* Caster wheels (5) — dark nylon */}
      {[0, 72, 144, 216, 288].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        return (
          <mesh key={`wheel-${i}`} position={[Math.cos(rad) * 0.48, 0.03, Math.sin(rad) * 0.48]} castShadow>
            <sphereGeometry args={[0.045, 24, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.2} />
          </mesh>
        )
      })}
    </group>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Product catalog
// ────────────────────────────────────────────────────────────────────────

const CHAIR_PRODUCTS: ProductDef[] = [
  {
    id: 'modern-2seater',
    type: 'chair',
    nameEn: 'Modern 2-Seater Sofa',
    nameBn: 'মডার্ন ২-সিটার সোফা',
    descEn: 'Minimalist 2-seater with cushions, pillows, and metal legs',
    descBn: 'কুশন, বালিশ ও ধাতব পা সহ মিনিমালিস্ট ২-সিটার',
    render3D: (tex) => <ModernSofa fabricTexture={tex} />,
  },
  {
    id: 'modern-3seater',
    type: 'chair',
    nameEn: 'Modern 3-Seater Sofa',
    nameBn: 'মডার্ন ৩-সিটার সোফা',
    descEn: 'Extended 3-seater version with three seat + backrest cushions',
    descBn: 'তিনটি সিট ও ব্যাকরেস্ট কুশন সহ বর্ধিত ৩-সিটার',
    render3D: (tex) => <Sofa3Seater fabricTexture={tex} />,
  },
  {
    id: 'armchair',
    type: 'chair',
    nameEn: 'Single Armchair',
    nameBn: 'সিঙ্গেল আর্মচেয়ার',
    descEn: 'Compact single-seater armchair',
    descBn: 'কম্প্যাক্ট সিঙ্গেল-সিটার আর্মচেয়ার',
    render3D: (tex) => <Armchair3D fabricTexture={tex} />,
  },
  {
    id: 'office-chair',
    type: 'chair',
    nameEn: 'Office Chair',
    nameBn: 'অফিস চেয়ার',
    descEn: 'High-back executive chair with 5-star base and wheels',
    descBn: '৫-স্টার বেস ও চাকা সহ হাই-ব্যাক এক্সিকিউটিভ চেয়ার',
    render3D: (tex) => <OfficeChair3D fabricTexture={tex} />,
  },
]

const ALL_PRODUCTS = [...CHAIR_PRODUCTS]

// ────────────────────────────────────────────────────────────────────────
// 3D Scene wrapper
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
  const fabricTexture = useFabricTexture(fabricUrl, fabricRepeat)

  return (
    <>
      <PerspectiveCamera makeDefault position={[3.5, 1.8, 4]} fov={38} />

      {/* ★ Realistic studio lighting — 3-point setup + soft ambient
         - Key light: strong, top-right, casts HIGH-RES soft shadows (4K)
         - Fill light: opposite side, weaker, fills shadow areas
         - Rim light: from behind, adds edge highlight (separates from bg)
         - Ambient: low base level so shadows aren't pure black */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[6, 8, 5]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0005}
        shadow-radius={8}
        shadow-blurSamples={32}
      />
      {/* Fill light — softer, opposite side, cool tint */}
      <directionalLight position={[-6, 5, -3]} intensity={0.8} color="#dfe7f5" />
      {/* Rim light — adds edge highlight from behind */}
      <directionalLight position={[0, 4, -6]} intensity={0.7} color="#ffffff" />

      {/* The actual 3D product */}
      <Suspense fallback={null}>
        {product.render3D(fabricTexture)}
      </Suspense>

      {/* ★ High-res soft contact shadow — large blur for realistic grounding */}
      <ContactShadows
        position={[0, -0.59, 0]}
        opacity={0.65}
        scale={14}
        blur={3.5}
        far={5}
        resolution={2048}
        color="#0a0a0a"
      />

      {/* ★ Subtle floor plane — light concrete look, helps ground the model */}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[10, 96]} />
        <meshStandardMaterial
          color="#eceae5"
          roughness={0.75}
          metalness={0.0}
        />
      </mesh>

      {/* OrbitControls — customer can rotate (left-drag), zoom (wheel), pan (right-drag) */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}   // 30° from top
        maxPolarAngle={Math.PI / 2.05} // just above horizontal
        target={[0, 0.5, 0]}
        makeDefault
      />

      {/* ★ Studio HDRI environment for realistic reflections on metal legs + fabric sheen */}
      <Environment preset="studio" background={false} />

      {/* ★ POST-PROCESSING — this is what takes the render from "3D looking"
          to "photorealistic". SSAO adds darkening in corners/crevices (where
          ambient light can't reach) which is what makes real-world scenes
          feel grounded. Bloom adds a subtle glow to highlights. Vignette
          darkens the corners of the frame for a professional photo look.
          SMAA = subpixel anti-aliasing for sharper edges. */}
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={0.15}
          intensity={20}
          luminanceInfluence={0.6}
          color={new THREE.Color('#1a1a1a')}
        />
        <Bloom
          intensity={0.18}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  )
}

// Loader spinner shown while Canvas initializes
function CanvasLoader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className="bg-white/90 backdrop-blur px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-slate-700">
        {progress.toFixed(0)}% loaded...
      </div>
    </Html>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Main FabricStudio3D component
// ────────────────────────────────────────────────────────────────────────

interface FabricStudio3DProps {
  onPlaceOrder?: (product: ProductDef, fabric: FabricDef | null) => void
}

export default function FabricStudio3D({ onPlaceOrder }: FabricStudio3DProps) {
  const { t } = useLanguage()
  const [selectedProductId, setSelectedProductId] = useState<string>(CHAIR_PRODUCTS[0].id)
  const [fabrics, setFabrics] = useState<FabricDef[]>(PRESET_FABRICS)
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(PRESET_FABRICS[0].id)
  const [fabricRepeat, setFabricRepeat] = useState<number>(4) // tile count (1-12)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Load user-uploaded fabrics from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dfcl-fabric-studio-3d-uploads')
      if (saved) {
        const parsed: FabricDef[] = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFabrics(prev => [...parsed, ...prev])
        }
      }
    } catch {}
  }, [])

  const persistUploads = (uploads: FabricDef[]) => {
    try { localStorage.setItem('dfcl-fabric-studio-3d-uploads', JSON.stringify(uploads)) } catch {}
  }

  const selectedProduct = useMemo(
    () => ALL_PRODUCTS.find(p => p.id === selectedProductId) || CHAIR_PRODUCTS[0],
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

  const handleReset = () => setFabricRepeat(4)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-600" />
            {t('Fabric Studio (3D)', 'ফ্যাব্রিক স্টুডিও (3D)')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <Move3d className="w-3.5 h-3.5" />
            {t('Drag to rotate · Scroll to zoom · Right-click to pan', 'ঘোরাতে টানুন · জুম করতে স্ক্রল করুন · প্যান করতে রাইট-ক্লিক করুন')}
          </p>
        </div>
      </div>

      {/* Product gallery — horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {CHAIR_PRODUCTS.map(p => (
          <ProductCard3D
            key={p.id}
            product={p}
            selected={selectedProductId === p.id}
            onSelect={() => setSelectedProductId(p.id)}
            t={t}
          />
        ))}
      </div>

      {/* Main preview + fabric controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 3D Preview area (2 cols on lg) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Maximize2 className="w-4 h-4" />
                {t(selectedProduct.nameEn, selectedProduct.nameBn)}
              </CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Move3d className="w-3 h-3" />{t('Rotate', 'ঘোরান')}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3" />{t('Zoom', 'জুম')}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t(selectedProduct.descEn, selectedProduct.descBn)}</p>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl overflow-hidden relative"
              style={{
                // Studio backdrop — soft vertical gradient like a professional product photo
                background: 'linear-gradient(180deg, #f5f6f8 0%, #e2e5ea 60%, #c9cdd4 100%)',
                minHeight: '450px',
              }}
            >
              <Canvas
                shadows
                dpr={[1, 2]}
                gl={{
                  antialias: true,
                  preserveDrawingBuffer: true,
                  // Better color rendering — sRGB output + tone mapping for realism
                  toneMapping: 2, // ACESFilmicToneMapping
                  toneMappingExposure: 1.1,
                }}
                style={{ width: '100%', height: '450px', cursor: 'grab' }}
              >
                <Suspense fallback={<CanvasLoader />}>
                  <Scene
                    product={selectedProduct}
                    fabricUrl={selectedFabric?.url || null}
                    fabricRepeat={fabricRepeat}
                  />
                </Suspense>
              </Canvas>

              {/* Floating hint badge bottom-left */}
              <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur px-2.5 py-1.5 rounded-md text-[11px] text-slate-600 shadow-sm pointer-events-none">
                <span className="flex items-center gap-1">
                  <Move3d className="w-3 h-3" />
                  {t('Drag to rotate', 'ঘোরাতে টানুন')}
                </span>
              </div>
            </div>
            {selectedFabric && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {t('Fabric:', 'ফ্যাব্রিক:')} <span className="font-medium text-foreground">{t(selectedFabric.nameEn, selectedFabric.nameBn)}</span>
                {' · '}{t('Tile Repeat:', 'টাইল রিপিট:')} {fabricRepeat}×{fabricRepeat}
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
                {t('JPG / PNG / WebP up to 5 MB · pattern auto-repeats', 'JPG / PNG / WebP — সর্বোচ্চ ৫ মেগাবাইট · প্যাটার্ন অটো-রিপিট হবে')}
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

            {/* Pattern repeat slider */}
            {selectedFabric ? (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="flex justify-between mb-1">
                    <Label className="text-xs">{t('Pattern Repeat (Tile Count)', 'প্যাটার্ন রিপিট (টাইল সংখ্যা)')}</Label>
                    <span className="text-xs text-muted-foreground font-mono">{fabricRepeat}×{fabricRepeat}</span>
                  </div>
                  <Slider value={[fabricRepeat]} min={1} max={12} step={1} onValueChange={v => setFabricRepeat(v[0])} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t('Higher = smaller pattern (more repeats). Lower = larger pattern.', 'বেশি = ছোট প্যাটার্ন (বেশি রিপিট)। কম = বড় প্যাটার্ন।')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {t('Reset to Default (4×4)', 'ডিফল্টে রিসেট (৪×৪)')}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                {t('Pick or upload a fabric to see it on the 3D model', '3D মডেলে দেখতে একটি ফ্যাব্রিক নির্বাচন করুন বা আপলোড করুন')}
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
// Product card — thumbnail using a mini Canvas
// ────────────────────────────────────────────────────────────────────────
// To keep performance reasonable, we use a static SVG icon for the
// thumbnail (no per-card Canvas). The 3D preview is shown only in the
// main preview area.

function ProductCard3D({
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
      className={`shrink-0 w-36 rounded-xl overflow-hidden border-2 bg-white transition-all text-left ${selected ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}
    >
      <div className="aspect-square flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f1f5f9, #cbd5e1)' }}>
        <Sofa className="w-12 h-12 text-slate-500" strokeWidth={1.2} />
      </div>
      <div className="p-2 border-t border-slate-100">
        <p className="text-xs font-medium text-foreground truncate">{t(product.nameEn, product.nameBn)}</p>
      </div>
    </button>
  )
}
