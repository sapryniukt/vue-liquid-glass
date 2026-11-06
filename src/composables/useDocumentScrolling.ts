import { readonly, ref } from 'vue'

/** Shared by every glass filter. True only while the page is actually moving. */
const scrolling = ref(false)

let timer = 0
let listening = false

function onScroll() {
  if (!scrolling.value) scrolling.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    scrolling.value = false
  }, 140)
}

function start() {
  if (listening || typeof window === 'undefined') return
  listening = true
  const capture = { passive: true, capture: true } as const
  document.addEventListener('scroll', onScroll, capture)
  window.addEventListener('scroll', onScroll, capture)
  window.addEventListener('wheel', onScroll, { passive: true })
}

if (typeof window !== 'undefined') start()

export function useDocumentScrolling() {
  return readonly(scrolling)
}
