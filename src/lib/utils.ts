let sharedCanvas: HTMLCanvasElement | null = null
let sharedCtx: CanvasRenderingContext2D | null = null

export function imageDataToDataUrl(imageData: ImageData): string {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas')
    sharedCtx = sharedCanvas.getContext('2d')
  }
  if (!sharedCtx || !sharedCanvas) return ''
  if (sharedCanvas.width !== imageData.width || sharedCanvas.height !== imageData.height) {
    sharedCanvas.width = imageData.width
    sharedCanvas.height = imageData.height
  }
  sharedCtx.putImageData(imageData, 0, 0)
  return sharedCanvas.toDataURL('image/png')
}

const urlCache = new Map<string, string>()
const URL_CACHE_MAX = 32

/** Reuse an encoded map when the same glass geometry is built again. */
export function cachedImageDataUrl(key: string, build: () => ImageData): string {
  const hit = urlCache.get(key)
  if (hit !== undefined) {
    urlCache.delete(key)
    urlCache.set(key, hit)
    return hit
  }
  const url = imageDataToDataUrl(build())
  urlCache.set(key, url)
  if (urlCache.size > URL_CACHE_MAX) {
    const oldest = urlCache.keys().next().value
    if (oldest !== undefined) urlCache.delete(oldest)
  }
  return url
}

export function getDevicePixelRatio(override?: number): number {
  return override ?? (typeof window !== 'undefined' ? window.devicePixelRatio ?? 1 : 1)
}

let idCounter = 0;

/**
 * SSR-unsafe for IDs embedded in HTML; prefer `useId()` from Vue in components.
 * Kept for backwards compatibility with deterministic counter-only suffix.
 */
export function generateFilterId(prefix = "liquid-glass"): string {
  return `${prefix}-${++idCounter}`;
}
