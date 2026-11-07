import type { ShapeType } from '../types'
import { getDevicePixelRatio } from './utils'

/**
 * Pre-compute a 1D displacement profile along a single bezel radius.
 * Uses simplified Snell's-law refraction for a vertical incident ray.
 * Returns an array of horizontal displacement magnitudes (in pixels).
 */
export function calculateDisplacementMap(
  glassThickness: number = 200,
  bezelWidth: number = 50,
  bezelHeightFn: (x: number) => number = (x) => x,
  refractiveIndex: number = 1.5,
  samples: number = 128
): number[] {
  const eta = 1 / refractiveIndex

  function refract(normalX: number, normalY: number): [number, number] | null {
    const dot = normalY
    const k = 1 - eta * eta * (1 - dot * dot)
    if (k < 0) return null
    const kSqrt = Math.sqrt(k)
    return [
      -(eta * dot + kSqrt) * normalX,
      eta - (eta * dot + kSqrt) * normalY,
    ]
  }

  return Array.from({ length: samples }, (_, i) => {
    const x = i / samples
    const y = bezelHeightFn(x)

    const dx = x < 1 ? 0.0001 : -0.0001
    const y2 = bezelHeightFn(x + dx)
    const derivative = (y2 - y) / dx
    const magnitude = Math.sqrt(derivative * derivative + 1)
    const normal: [number, number] = [-derivative / magnitude, -1 / magnitude]
    const refracted = refract(normal[0], normal[1])

    if (!refracted) {
      return 0
    } else {
      const remainingHeightOnBezel = y * bezelWidth
      const remainingHeight = remainingHeightOnBezel + glassThickness
      return refracted[0] * (remainingHeight / refracted[1])
    }
  })
}

/**
 * Generate a 2D displacement map for a rounded-rectangle (circle corners).
 * Encodes X/Y displacement in R/G channels around neutral 128.
 */
export function calculateDisplacementMap2D(
  canvasWidth: number,
  canvasHeight: number,
  objectWidth: number,
  objectHeight: number,
  radius: number,
  bezelWidth: number,
  maximumDisplacement: number,
  precomputedDisplacementMap: number[] = [],
  dpr?: number
): ImageData {
  const devicePixelRatio = getDevicePixelRatio(dpr)
  const bufferWidth = Math.floor(canvasWidth * devicePixelRatio)
  const bufferHeight = Math.floor(canvasHeight * devicePixelRatio)

  const imageData = new ImageData(bufferWidth, bufferHeight)
  const neutral = 0xff008080
  new Uint32Array(imageData.data.buffer).fill(neutral)

  const radius_ = radius * devicePixelRatio
  const bezel = bezelWidth * devicePixelRatio

  const radiusSquared = radius_ ** 2
  const radiusPlusOneSquared = (radius_ + 1) ** 2
  const radiusMinusBezelSquared = (radius_ - bezel) ** 2

  // Whole pixels: a fractional index into ImageData is silently dropped.
  const objectWidth_ = Math.min(bufferWidth, Math.round(objectWidth * devicePixelRatio))
  const objectHeight_ = Math.min(bufferHeight, Math.round(objectHeight * devicePixelRatio))
  const widthBetweenRadiuses = objectWidth_ - radius_ * 2
  const heightBetweenRadiuses = objectHeight_ - radius_ * 2

  const objectX = Math.floor((bufferWidth - objectWidth_) / 2)
  const objectY = Math.floor((bufferHeight - objectHeight_) / 2)

  for (let y1 = 0; y1 < objectHeight_; y1++) {
    for (let x1 = 0; x1 < objectWidth_; x1++) {
      const idx = ((objectY + y1) * bufferWidth + objectX + x1) * 4

      const isOnLeftSide = x1 < radius_
      const isOnRightSide = x1 >= objectWidth_ - radius_
      const isOnTopSide = y1 < radius_
      const isOnBottomSide = y1 >= objectHeight_ - radius_

      const x = isOnLeftSide
        ? x1 - radius_
        : isOnRightSide
          ? x1 - radius_ - widthBetweenRadiuses
          : 0

      const y = isOnTopSide
        ? y1 - radius_
        : isOnBottomSide
          ? y1 - radius_ - heightBetweenRadiuses
          : 0

      const distanceToCenterSquared = x * x + y * y

      const isInBezel =
        distanceToCenterSquared <= radiusPlusOneSquared &&
        distanceToCenterSquared >= radiusMinusBezelSquared

      if (isInBezel) {
        const opacity =
          distanceToCenterSquared < radiusSquared
            ? 1
            : 1 -
              (Math.sqrt(distanceToCenterSquared) - Math.sqrt(radiusSquared)) /
              (Math.sqrt(radiusPlusOneSquared) - Math.sqrt(radiusSquared))

        const distanceFromCenter = Math.sqrt(distanceToCenterSquared)
        const distanceFromSide = radius_ - distanceFromCenter

        const cos = x / distanceFromCenter
        const sin = y / distanceFromCenter

        const bezelIndex =
          ((distanceFromSide / bezel) * precomputedDisplacementMap.length) | 0
        const distance = precomputedDisplacementMap[bezelIndex] ?? 0

        const dX = (-cos * distance) / maximumDisplacement
        const dY = (-sin * distance) / maximumDisplacement

        imageData.data[idx] = 128 + dX * 127 * opacity
        imageData.data[idx + 1] = 128 + dY * 127 * opacity
        imageData.data[idx + 2] = 0
        imageData.data[idx + 3] = 255
      }
    }
  }
  return imageData
}

/**
 * Generate a 2D displacement map for arbitrary shapes:
 * circle, pill, squircle, or rectangle with configurable corner radius.
 */
export function calculateDisplacementMapWithShape(
  canvasWidth: number,
  canvasHeight: number,
  objectWidth: number,
  objectHeight: number,
  bezelWidth: number,
  maximumDisplacement: number,
  precomputedDisplacementMap: number[] = [],
  shape: ShapeType = 'circle',
  cornerRadius: number = 1.0,
  squircleExponent: number = 4,
  dpr?: number
): ImageData {
  const devicePixelRatio = getDevicePixelRatio(dpr)
  const bufferWidth = Math.floor(canvasWidth * devicePixelRatio)
  const bufferHeight = Math.floor(canvasHeight * devicePixelRatio)

  const imageData = new ImageData(bufferWidth, bufferHeight)
  const neutral = 0xff008080
  new Uint32Array(imageData.data.buffer).fill(neutral)

  // Whole pixels: a fractional index into ImageData is silently dropped.
  const objectWidth_ = Math.min(bufferWidth, Math.round(objectWidth * devicePixelRatio))
  const objectHeight_ = Math.min(bufferHeight, Math.round(objectHeight * devicePixelRatio))
  const bezel = bezelWidth * devicePixelRatio

  const objectX = Math.floor((bufferWidth - objectWidth_) / 2)
  const objectY = Math.floor((bufferHeight - objectHeight_) / 2)

  const maxCornerRadius = Math.min(objectWidth_, objectHeight_) / 2
  let actualRadius: number

  switch (shape) {
    case 'circle':
      actualRadius = maxCornerRadius
      break
    case 'pill':
      actualRadius = Math.min(objectWidth_, objectHeight_) / 2
      break
    case 'rectangle':
      actualRadius = cornerRadius * maxCornerRadius
      break
    case 'squircle':
    default:
      actualRadius = cornerRadius * maxCornerRadius
      break
  }

  const radius_ = actualRadius
  const radiusSquared = radius_ ** 2
  const radiusPlusOneSquared = (radius_ + 1) ** 2
  const radiusMinusBezelSquared = Math.max(0, (radius_ - bezel) ** 2)

  const widthBetweenRadiuses = Math.max(0, objectWidth_ - radius_ * 2)
  const heightBetweenRadiuses = Math.max(0, objectHeight_ - radius_ * 2)

  const squircleDistance = (x: number, y: number, r: number, n: number): number => {
    if (r === 0) return Math.sqrt(x * x + y * y)
    const absX = Math.abs(x) / r
    const absY = Math.abs(y) / r
    return Math.pow(Math.pow(absX, n) + Math.pow(absY, n), 1 / n) * r
  }

  for (let y1 = 0; y1 < objectHeight_; y1++) {
    for (let x1 = 0; x1 < objectWidth_; x1++) {
      const idx = ((objectY + y1) * bufferWidth + objectX + x1) * 4

      const isOnLeftSide = x1 < radius_
      const isOnRightSide = x1 >= objectWidth_ - radius_
      const isOnTopSide = y1 < radius_
      const isOnBottomSide = y1 >= objectHeight_ - radius_

      let x = 0, y = 0
      let distanceToEdge = 0
      let normalX = 0, normalY = 0
      let isInBezelRegion = false

      if ((isOnLeftSide || isOnRightSide) && (isOnTopSide || isOnBottomSide)) {
        x = isOnLeftSide ? x1 - radius_ : x1 - (objectWidth_ - radius_)
        y = isOnTopSide ? y1 - radius_ : y1 - (objectHeight_ - radius_)

        let distanceFromCornerCenter: number

        if (shape === 'squircle' && cornerRadius > 0) {
          distanceFromCornerCenter = squircleDistance(x, y, radius_, squircleExponent)
        } else {
          distanceFromCornerCenter = Math.sqrt(x * x + y * y)
        }

        distanceToEdge = radius_ - distanceFromCornerCenter

        if (distanceToEdge >= -1 && distanceToEdge <= bezel) {
          isInBezelRegion = true
          const magnitude = Math.sqrt(x * x + y * y) || 1
          normalX = x / magnitude
          normalY = y / magnitude
        }
      } else if (isOnLeftSide || isOnRightSide) {
        distanceToEdge = isOnLeftSide ? x1 : (objectWidth_ - 1 - x1)
        if (distanceToEdge <= bezel) {
          isInBezelRegion = true
          normalX = isOnLeftSide ? -1 : 1
          normalY = 0
        }
      } else if (isOnTopSide || isOnBottomSide) {
        distanceToEdge = isOnTopSide ? y1 : (objectHeight_ - 1 - y1)
        if (distanceToEdge <= bezel) {
          isInBezelRegion = true
          normalX = 0
          normalY = isOnTopSide ? -1 : 1
        }
      }

      if (isInBezelRegion && distanceToEdge >= 0) {
        const opacity = distanceToEdge >= 0 ? 1 : Math.max(0, 1 + distanceToEdge)

        const bezelIndex = Math.min(
          precomputedDisplacementMap.length - 1,
          Math.max(0, ((distanceToEdge / bezel) * precomputedDisplacementMap.length) | 0)
        )
        const distance = precomputedDisplacementMap[bezelIndex] ?? 0

        const dX = (-normalX * distance) / maximumDisplacement
        const dY = (-normalY * distance) / maximumDisplacement

        imageData.data[idx] = 128 + dX * 127 * opacity
        imageData.data[idx + 1] = 128 + dY * 127 * opacity
        imageData.data[idx + 2] = 0
        imageData.data[idx + 3] = 255
      }
    }
  }
  return imageData
}

/** Channel normalizer used when the displacement bitmap is encoded. */
export const DISPLACEMENT_NORMALIZER = 100

/** Signed profile sample with the largest magnitude. */
export function peakDisplacement(profile: number[]): number {
  let peak = 0
  for (let i = 0; i < profile.length; i++) {
    const value = profile[i]
    if (Math.abs(value) > Math.abs(peak)) peak = value
  }
  return peak
}

/** feDisplacementMap scale factor for a profile. A flat profile stays at 1. */
export function displacementScaleMax(profile: number[]): number {
  return Math.abs(peakDisplacement(profile)) || 1
}

function storedChannelOffset(sample: number): number {
  return (128 + (sample / DISPLACEMENT_NORMALIZER) * 127) / 255 - 0.5
}

/**
 * Scale that keeps the peak refraction of `nextProfile` while the bitmap
 * still stores `bakedPeak`.
 */
export function reusedDisplacementMax(bakedPeak: number, nextProfile: number[]): number {
  const nextScale = displacementScaleMax(nextProfile)
  const bakedOffset = storedChannelOffset(bakedPeak)
  if (bakedOffset === 0) return nextScale
  return nextScale * storedChannelOffset(peakDisplacement(nextProfile)) / bakedOffset
}

/** Worst-case CSS-pixel error of reusing a baked profile at `scaleRatio`. */
export function reusedDisplacementErrorPx(
  baked: number[],
  next: number[],
  scaleRatio: number,
): number {
  if (baked.length !== next.length || baked.length === 0) return Number.POSITIVE_INFINITY
  const scale = reusedDisplacementMax(peakDisplacement(baked), next)
  const nextScale = displacementScaleMax(next)
  let err = 0
  const ratio = Math.abs(scaleRatio)
  for (let i = 0; i < baked.length; i++) {
    const fresh = nextScale * storedChannelOffset(next[i])
    const approx = scale * storedChannelOffset(baked[i])
    const delta = Math.abs(fresh - approx) * ratio
    if (delta > err) err = delta
  }
  return err
}
