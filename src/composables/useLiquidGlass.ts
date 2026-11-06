import {
  ref,
  reactive,
  watch,
  onMounted,
  onUnmounted,
  computed,
  useId,
  type Ref,
  type CSSProperties,
} from 'vue'
import type { BezelType, ShapeType, GlassConfig, GlassFilterAssets } from '../types'
import { calculateDisplacementMap, calculateDisplacementMap2D, calculateDisplacementMapWithShape } from '../lib/displacementMap'
import { calculateSpecularMap } from '../lib/specular'
import { calculateMagnifyingMap } from '../lib/magnifyingDisplacement'
import { CONVEX, CONVEX_CIRCLE, CONCAVE, LIP } from '../lib/surfaceEquations'
import { imageDataToDataUrl } from '../lib/utils'

export interface UseLiquidGlassOptions {
  width?: Ref<number> | number
  height?: Ref<number> | number
  radius?: number
  bezelWidth?: number
  glassThickness?: number
  refractiveIndex?: number
  bezelType?: BezelType
  shape?: ShapeType
  cornerRadius?: number
  squircleExponent?: number
  quality?: number
  blur?: number
  scaleRatio?: number
  specularOpacity?: number
  specularSaturation?: number
  specularAngle?: number
  magnify?: boolean
  magnifyingScale?: number
  autoResize?: boolean
}

function resolveRef(val: Ref<number> | number | undefined, fallback: number): number {
  if (val === undefined) return fallback
  if (typeof val === 'number') return val
  return val.value
}

function getSurfaceFn(bezelType: BezelType) {
  switch (bezelType) {
    case 'convex_circle': return CONVEX_CIRCLE.fn
    case 'convex_squircle': return CONVEX.fn
    case 'concave': return CONCAVE.fn
    case 'lip': return LIP.fn
    default: return CONVEX.fn
  }
}

/**
 * Main composable that orchestrates the full liquid glass filter lifecycle.
 *
 * Generates displacement, specular, and magnifying maps reactively,
 * returns a unique filter ID and a ready-to-bind backdrop-filter style object.
 *
 * Pass an element ref to enable auto-resize via ResizeObserver.
 */
export function useLiquidGlass(
  elementRef?: Ref<HTMLElement | null>,
  options: UseLiquidGlassOptions = {}
) {
  const filterId = `liquid-glass-${useId()}`

  const assets = reactive<GlassFilterAssets>({
    displacementMapUrl: '',
    specularMapUrl: '',
    magnifyingMapUrl: '',
    maxDisplacement: 0,
  })

  const observedWidth = ref(resolveRef(options.width, 150))
  const observedHeight = ref(resolveRef(options.height, 150))

  let regenerateTimeout: ReturnType<typeof setTimeout> | null = null
  let resizeObserver: ResizeObserver | null = null

  function regenerate() {
    const w = resolveRef(options.width, observedWidth.value)
    const h = resolveRef(options.height, observedHeight.value)
    const bezelWidth = options.bezelWidth ?? 40
    const glassThickness = options.glassThickness ?? 120
    const refractiveIndex = options.refractiveIndex ?? 1.5
    const bezelType = options.bezelType ?? 'convex_squircle'
    const shape = options.shape ?? 'pill'
    const cornerRadius = options.cornerRadius ?? 1.0
    const squircleExponent = options.squircleExponent ?? 2
    const quality = options.quality ?? 2
    const radius = options.radius ?? Math.min(w, h) / 2

    const surfaceFn = getSurfaceFn(bezelType)

    const precomputedMap = calculateDisplacementMap(
      glassThickness,
      bezelWidth,
      surfaceFn,
      refractiveIndex
    )

    assets.maxDisplacement = Math.max(...precomputedMap.map(x => Math.abs(x))) || 1

    let displacementImageData: ImageData
    if (shape && shape !== 'circle') {
      displacementImageData = calculateDisplacementMapWithShape(
        w, h, w, h,
        bezelWidth, 100, precomputedMap,
        shape, cornerRadius, squircleExponent, quality
      )
    } else {
      displacementImageData = calculateDisplacementMap2D(
        w, h, w, h,
        radius, bezelWidth, 100,
        precomputedMap, quality
      )
    }

    assets.displacementMapUrl = imageDataToDataUrl(displacementImageData)

    const specularImageData = calculateSpecularMap(
      w, h, radius, bezelWidth,
      options.specularAngle, quality
    )
    assets.specularMapUrl = imageDataToDataUrl(specularImageData)

    if (options.magnify) {
      const magnifyingImageData = calculateMagnifyingMap(w, h, quality)
      assets.magnifyingMapUrl = imageDataToDataUrl(magnifyingImageData)
    }
  }

  function debouncedRegenerate() {
    if (regenerateTimeout) clearTimeout(regenerateTimeout)
    regenerateTimeout = setTimeout(regenerate, 16)
  }

  const scale = computed(() => assets.maxDisplacement * (options.scaleRatio ?? 1))

  const backdropStyle = computed<CSSProperties>(() => ({
    backdropFilter: `url(#${filterId})`,
    WebkitBackdropFilter: `url(#${filterId})`,
  }))

  // Watch reactive width/height refs if provided
  if (options.width && typeof options.width === 'object' && 'value' in options.width) {
    watch(options.width, debouncedRegenerate)
  }
  if (options.height && typeof options.height === 'object' && 'value' in options.height) {
    watch(options.height, debouncedRegenerate)
  }

  onMounted(() => {
    if (elementRef?.value && (options.autoResize !== false)) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          observedWidth.value = entry.contentRect.width
          observedHeight.value = entry.contentRect.height
        }
        debouncedRegenerate()
      })
      resizeObserver.observe(elementRef.value)
      observedWidth.value = elementRef.value.offsetWidth
      observedHeight.value = elementRef.value.offsetHeight
    }
    regenerate()
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
    if (regenerateTimeout) clearTimeout(regenerateTimeout)
  })

  return {
    filterId,
    assets,
    scale,
    backdropStyle,
    regenerate,
    observedWidth,
    observedHeight,
  }
}
