<script setup lang="ts">
import { computed, watch, ref, onUnmounted } from 'vue'
import type { ShapeType, BezelType } from '../types'
import {
  calculateDisplacementMap,
  calculateDisplacementMap2D,
  calculateDisplacementMapWithShape,
  DISPLACEMENT_NORMALIZER,
  displacementScaleMax,
  peakDisplacement,
  reusedDisplacementErrorPx,
  reusedDisplacementMax,
} from '../lib/displacementMap'
import { calculateSpecularMap } from '../lib/specular'
import { calculateMagnifyingMap } from '../lib/magnifyingDisplacement'
import { CONVEX, CONVEX_CIRCLE, CONCAVE, LIP } from '../lib/surfaceEquations'
import { cachedImageDataUrl } from '../lib/utils'

interface Props {
  id: string
  width?: number
  height?: number
  radius?: number
  bezelWidth?: number
  curvatureBoost?: number
  glassThickness?: number
  refractiveIndex?: number
  bezelType?: BezelType
  blur?: number
  scaleRatio?: number
  specularOpacity?: number
  specularSaturation?: number
  specularAngle?: number
  magnify?: boolean
  magnifyingScale?: number
  shape?: ShapeType
  cornerRadius?: number
  squircleExponent?: number
  quality?: number
  edgeChromatic?: boolean
  edgeChromaticStrength?: number
  edgeChromaticShift?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 150,
  height: 150,
  radius: 75,
  bezelWidth: 40,
  curvatureBoost: 1.22,
  glassThickness: 120,
  refractiveIndex: 1.5,
  bezelType: 'convex_squircle',
  blur: 0.2,
  scaleRatio: 1,
  specularOpacity: 0.4,
  specularSaturation: 4,
  magnify: false,
  magnifyingScale: 24,
  shape: 'pill',
  cornerRadius: 1.0,
  squircleExponent: 2,
  quality: 2,
  edgeChromatic: false,
  edgeChromaticStrength: 0.72,
  edgeChromaticShift: 0.5,
})

const displacementMapUrl = ref('')
const specularMapUrl = ref('')
const magnifyingMapUrl = ref('')
const maxDisplacement = ref(0)

const MIN_DIMENSION = 1
const LARGE_WIDTH_DELTA = 8
const LARGE_HEIGHT_DELTA = 4
const REGENERATE_DEBOUNCE_MS = 16
// Reusing the bitmap below this is invisible, and swapping it refilters the backdrop.
const DISPLACEMENT_ERROR_PX = 0.35

let regenerateTimeout: ReturnType<typeof setTimeout> | null = null
let hasGeneratedOnce = false
let lastGeneratedWidth = 0
let lastGeneratedHeight = 0
let bakedGeometry = ''
let bakedSpecular = ''
let bakedMagnify = ''
let bakedProfile: number[] | null = null

const safeWidth = computed(() => Math.max(MIN_DIMENSION, props.width))
const safeHeight = computed(() => Math.max(MIN_DIMENSION, props.height))

const clearRegenerateTimeout = () => {
  if (!regenerateTimeout) return
  clearTimeout(regenerateTimeout)
  regenerateTimeout = null
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

function effectiveBezel(width: number, height: number) {
  const maxBezelByGeometry = Math.max(2, Math.min(width, height) / 2 - 1)
  return Math.min(maxBezelByGeometry, Math.max(1, props.bezelWidth * props.curvatureBoost))
}

function geometryKey(width: number, height: number, bezel: number) {
  return [
    width, height, props.radius, bezel, props.glassThickness, props.bezelType,
    props.shape, props.cornerRadius, props.squircleExponent, props.quality,
  ].join('|')
}

function specularKey(width: number, height: number, bezel: number) {
  return [width, height, props.radius, bezel, props.specularAngle ?? '', props.quality].join('|')
}

function magnifyKey(width: number, height: number) {
  return props.magnify ? [width, height, props.quality].join('|') : ''
}

function worstScaleRatio() {
  const chroma = props.edgeChromatic ? 1 + Math.abs(props.edgeChromaticShift) : 1
  return props.scaleRatio * chroma
}

function regenerateAssets() {
  const surfaceFn = getSurfaceFn(props.bezelType)
  const width = safeWidth.value
  const height = safeHeight.value
  const bezel = effectiveBezel(width, height)

  const precomputedMap = calculateDisplacementMap(
    props.glassThickness,
    bezel,
    surfaceFn,
    props.refractiveIndex
  )

  const geometry = geometryKey(width, height, bezel)
  const reuseProfile = bakedProfile
    && geometry === bakedGeometry
    && reusedDisplacementErrorPx(bakedProfile, precomputedMap, worstScaleRatio()) <= DISPLACEMENT_ERROR_PX

  if (reuseProfile && bakedProfile) {
    maxDisplacement.value = reusedDisplacementMax(peakDisplacement(bakedProfile), precomputedMap)
  } else {
    const displacementKey = `disp|${geometry}|${props.refractiveIndex}`
    displacementMapUrl.value = cachedImageDataUrl(displacementKey, () => {
      if (props.shape && props.shape !== 'circle') {
        return calculateDisplacementMapWithShape(
          width, height, width, height,
          bezel, DISPLACEMENT_NORMALIZER, precomputedMap,
          props.shape, props.cornerRadius, props.squircleExponent, props.quality
        )
      }
      return calculateDisplacementMap2D(
        width, height, width, height,
        props.radius, bezel, DISPLACEMENT_NORMALIZER,
        precomputedMap, props.quality
      )
    })
    bakedProfile = precomputedMap
    bakedGeometry = geometry
    maxDisplacement.value = displacementScaleMax(precomputedMap)
  }

  const specKey = specularKey(width, height, bezel)
  if (specKey !== bakedSpecular) {
    specularMapUrl.value = cachedImageDataUrl(`spec|${specKey}`, () => calculateSpecularMap(
      width, height,
      props.radius, bezel,
      props.specularAngle, props.quality
    ))
    bakedSpecular = specKey
  }

  const magKey = magnifyKey(width, height)
  if (!props.magnify) {
    if (magnifyingMapUrl.value) magnifyingMapUrl.value = ''
    bakedMagnify = ''
  } else if (magKey !== bakedMagnify) {
    magnifyingMapUrl.value = cachedImageDataUrl(`mag|${magKey}`, () => calculateMagnifyingMap(
      width, height, props.quality
    ))
    bakedMagnify = magKey
  }

  hasGeneratedOnce = true
  lastGeneratedWidth = width
  lastGeneratedHeight = height
}

function debouncedRegenerate() {
  // Run the very first generation immediately to avoid visible pop on initial mount.
  if (!hasGeneratedOnce) {
    regenerateAssets()
    return
  }

  const widthDelta = Math.abs(safeWidth.value - lastGeneratedWidth)
  const heightDelta = Math.abs(safeHeight.value - lastGeneratedHeight)
  const hasLargeDimensionJump = widthDelta >= LARGE_WIDTH_DELTA || heightDelta >= LARGE_HEIGHT_DELTA

  // Large geometry changes should regenerate immediately to avoid one-frame stale filter.
  if (hasLargeDimensionJump) {
    clearRegenerateTimeout()
    regenerateAssets()
    return
  }
  clearRegenerateTimeout()
  regenerateTimeout = setTimeout(regenerateAssets, REGENERATE_DEBOUNCE_MS)
}

function onFilterDeps() {
  const width = safeWidth.value
  const height = safeHeight.value
  const bezel = effectiveBezel(width, height)
  if (
    hasGeneratedOnce &&
    bakedProfile &&
    geometryKey(width, height, bezel) === bakedGeometry &&
    specularKey(width, height, bezel) === bakedSpecular &&
    magnifyKey(width, height) === bakedMagnify
  ) {
    const profile = calculateDisplacementMap(
      props.glassThickness,
      bezel,
      getSurfaceFn(props.bezelType),
      props.refractiveIndex,
    )
    if (reusedDisplacementErrorPx(bakedProfile, profile, worstScaleRatio()) <= DISPLACEMENT_ERROR_PX) {
      clearRegenerateTimeout()
      maxDisplacement.value = reusedDisplacementMax(peakDisplacement(bakedProfile), profile)
      return
    }
  }
  debouncedRegenerate()
}

const filterDeps = () => [
  safeWidth.value, safeHeight.value, props.radius,
  props.bezelWidth, props.curvatureBoost, props.glassThickness, props.refractiveIndex,
  props.bezelType, props.magnify, props.specularAngle,
  props.shape, props.cornerRadius, props.squircleExponent, props.quality,
]

watch(
  filterDeps,
  onFilterDeps,
  { immediate: true, deep: true }
)

onUnmounted(() => {
  clearRegenerateTimeout()
})

const scale = computed(() => maxDisplacement.value * props.scaleRatio)
const scaleRed = computed(() => scale.value * (1 + props.edgeChromaticShift))
const scaleBlue = computed(() => scale.value * (1 - props.edgeChromaticShift))
const specularSaturationValue = computed(() => props.specularSaturation.toString())
</script>

<template>
  <svg color-interpolation-filters="sRGB" :style="{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }">
    <defs>
      <filter :id="id">
        <!-- Magnifying pre-warp (optional) -->
        <template v-if="magnify && magnifyingMapUrl">
          <feImage
            :href="magnifyingMapUrl"
            x="0" y="0"
            :width="width" :height="height"
            result="magnifying_displacement_map"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="magnifying_displacement_map"
            :scale="magnifyingScale"
            xChannelSelector="R"
            yChannelSelector="G"
            result="magnified_source"
          />
        </template>

        <!-- Gaussian blur -->
        <feGaussianBlur
          :in="magnify ? 'magnified_source' : 'SourceGraphic'"
          :stdDeviation="blur"
          result="blurred_source"
        />

        <!-- Main refraction displacement -->
        <feImage
          v-if="displacementMapUrl"
          :href="displacementMapUrl"
          x="0" y="0"
          :width="width" :height="height"
          result="displacement_map"
        />
        <feDisplacementMap
          in="blurred_source"
          in2="displacement_map"
          :scale="scale"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />

        <!-- Chromatic refraction: displace R/G/B at different scales like a real prism -->
        <template v-if="edgeChromatic">
          <feDisplacementMap
            in="blurred_source"
            in2="displacement_map"
            :scale="scaleRed"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced_r"
          />
          <feDisplacementMap
            in="blurred_source"
            in2="displacement_map"
            :scale="scaleBlue"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced_b"
          />
          <feColorMatrix
            in="displaced_r"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1"
            result="chan_red"
          />
          <feColorMatrix
            in="displaced"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1"
            result="chan_green"
          />
          <feColorMatrix
            in="displaced_b"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 0 1"
            result="chan_blue"
          />
          <feComposite
            in="chan_red"
            in2="chan_green"
            operator="arithmetic"
            k1="0" k2="1" k3="1" k4="0"
            result="chan_rg"
          />
          <feComposite
            in="chan_rg"
            in2="chan_blue"
            operator="arithmetic"
            k1="0" k2="1" k3="1" k4="0"
            result="displaced"
          />
        </template>

        <!-- Saturation boost -->
        <feColorMatrix
          in="displaced"
          type="saturate"
          :values="specularSaturationValue"
          result="displaced_saturated"
        />

        <!-- Specular highlight layer -->
        <feImage
          v-if="specularMapUrl"
          :href="specularMapUrl"
          x="0" y="0"
          :width="width" :height="height"
          result="specular_layer"
        />
        <feComposite
          in="displaced_saturated"
          in2="specular_layer"
          operator="in"
          result="specular_saturated"
        />
        <feComponentTransfer in="specular_layer" result="specular_faded">
          <feFuncA type="linear" :slope="specularOpacity" />
        </feComponentTransfer>

        <!-- Blend refraction + specular -->
        <feBlend
          in="specular_saturated"
          in2="displaced"
          mode="normal"
          result="withSaturation"
        />
        <feBlend
          in="specular_faded"
          in2="withSaturation"
          mode="normal"
        />
      </filter>
    </defs>
  </svg>
</template>
