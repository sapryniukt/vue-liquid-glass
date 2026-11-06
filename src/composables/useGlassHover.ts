import { ref, computed, onMounted, onUnmounted, type Ref, type CSSProperties } from 'vue'

export interface GlassHoverOptions {
  radius?: number
  intensity?: number
  baseBrightness?: number
  smoothing?: number
  fadeSmoothing?: number
}

export function useGlassHover(
  elementRef: Ref<HTMLElement | null>,
  options: GlassHoverOptions = {}
) {
  const {
    radius = 150,
    intensity = 0.18,
    baseBrightness = 0.06,
    smoothing = 0.1,
    fadeSmoothing = 0.12,
  } = options

  const rawX = ref(0)
  const rawY = ref(0)
  const smoothX = ref(0)
  const smoothY = ref(0)
  const isHovering = ref(false)
  const smoothOpacity = ref(0)

  let rafId: number | null = null

  const tick = () => {
    smoothX.value += (rawX.value - smoothX.value) * smoothing
    smoothY.value += (rawY.value - smoothY.value) * smoothing

    const targetOpacity = isHovering.value ? 1 : 0
    smoothOpacity.value += (targetOpacity - smoothOpacity.value) * fadeSmoothing

    const posSettled =
      Math.abs(rawX.value - smoothX.value) < 0.5 &&
      Math.abs(rawY.value - smoothY.value) < 0.5
    const opacitySettled = Math.abs(targetOpacity - smoothOpacity.value) < 0.005

    if (posSettled && opacitySettled) {
      smoothX.value = rawX.value
      smoothY.value = rawY.value
      smoothOpacity.value = targetOpacity
      rafId = null
      return
    }

    rafId = requestAnimationFrame(tick)
  }

  const ensureRaf = () => {
    if (rafId === null) {
      rafId = requestAnimationFrame(tick)
    }
  }

  const onMouseEnter = () => {
    isHovering.value = true
    ensureRaf()
  }

  const onMouseMove = (e: MouseEvent) => {
    const el = elementRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    rawX.value = e.clientX - rect.left
    rawY.value = e.clientY - rect.top
    ensureRaf()
  }

  const onMouseLeave = () => {
    isHovering.value = false
    ensureRaf()
  }

  onMounted(() => {
    const el = elementRef.value
    if (!el) return
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)
  })

  onUnmounted(() => {
    const el = elementRef.value
    if (el) {
      el.removeEventListener('mouseenter', onMouseEnter)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  })

  const hoverStyle = computed<CSSProperties>(() => ({
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    opacity: smoothOpacity.value,
    background: `radial-gradient(circle ${radius}px at ${smoothX.value}px ${smoothY.value}px, rgba(255,255,255,${intensity}), transparent), linear-gradient(rgba(255,255,255,${baseBrightness}), rgba(255,255,255,${baseBrightness}))`,
  }))

  return {
    mouseX: smoothX,
    mouseY: smoothY,
    isHovering,
    hoverProgress: smoothOpacity,
    hoverStyle,
  }
}
