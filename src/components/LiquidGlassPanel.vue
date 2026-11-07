<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  getCurrentInstance,
  useId,
  type CSSProperties,
} from "vue";
import type { BezelType, ShapeType } from "../types";
import {
  useGlassHover,
  type GlassHoverOptions,
} from "../composables/useGlassHover";
import LiquidGlassFilter from "./LiquidGlassFilter.vue";
import GradientBlur from "./GradientBlur.vue";

interface Props {
  borderRadius?: number;
  bezelWidth?: number;
  glassThickness?: number;
  refractiveIndex?: number;
  bezelType?: BezelType;
  shape?: ShapeType;
  cornerRadius?: number;
  squircleExponent?: number;
  quality?: number;
  blur?: number;
  scaleRatio?: number;
  specularOpacity?: number;
  specularSaturation?: number;
  specularAngle?: number;
  magnify?: boolean;
  magnifyingScale?: number;
  gradientBlurSize?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  shadow?: string;
  borderWidth?: number;
  borderColor?: string;
  contentPadding?: string;
  contentOverflowY?: "auto" | "scroll" | "hidden";
  centerBlurAmount?: number;
  hoverRefractiveBoost?: number;
  disabled?: boolean;
  hoverLight?: boolean;
  hoverLightOptions?: GlassHoverOptions;
  scrollFast?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  borderRadius: 50,
  bezelWidth: 40,
  glassThickness: 120,
  refractiveIndex: 1.5,
  bezelType: "convex_squircle",
  shape: "pill",
  cornerRadius: 1.0,
  squircleExponent: 2,
  quality: 2,
  blur: 1,
  scaleRatio: 0.4,
  specularOpacity: 0.4,
  specularSaturation: 8,
  magnify: false,
  magnifyingScale: 24,
  gradientBlurSize: 60,
  backgroundColor: "var(--lg-panel-bg, rgba(255, 255, 255, 0.05))",
  backgroundOpacity: 1,
  shadow: "var(--lg-panel-shadow, 0 2px 10px rgba(0, 0, 0, 0.05))",
  borderWidth: 1,
  borderColor: "var(--lg-panel-border, rgba(255, 255, 255, 0.15))",
  contentPadding: "20px",
  contentOverflowY: "auto",
  centerBlurAmount: 3,
  hoverRefractiveBoost: 0.12,
  disabled: false,
  hoverLight: false,
  scrollFast: true,
});

const containerRef = ref<HTMLElement | null>(null);
const instance = getCurrentInstance();

function panelElement() {
  if (containerRef.value instanceof HTMLElement) return containerRef.value;
  const el = instance?.vnode.el;
  return el instanceof HTMLElement ? el : null;
}
const { hoverStyle, hoverProgress } = useGlassHover(
  containerRef,
  props.hoverLightOptions,
);
const panelWidth = ref(300);
const panelHeight = ref(200);
const hasMeasuredPanel = ref(false);

const filterId = `lg-panel-${useId()}`;

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  const el = panelElement();
  if (!el) return;
  containerRef.value = el;
  panelWidth.value = Math.round(el.offsetWidth);
  panelHeight.value = Math.round(el.offsetHeight);
  hasMeasuredPanel.value = panelWidth.value > 0 && panelHeight.value > 0;

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);
      if (nextWidth === panelWidth.value && nextHeight === panelHeight.value) continue;
      panelWidth.value = nextWidth;
      panelHeight.value = nextHeight;
      if (!hasMeasuredPanel.value && nextWidth > 0 && nextHeight > 0) {
        hasMeasuredPanel.value = true;
      }
    }
  });
  resizeObserver.observe(el);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

const radius = computed(() =>
  Math.min(
    props.borderRadius,
    Math.min(panelWidth.value, panelHeight.value) / 2,
  ),
);
const hoverRefractiveIndex = computed(
  () =>
    props.refractiveIndex + hoverProgress.value * props.hoverRefractiveBoost,
);

// Backdrop filters cost per frame by area and the map is neutral inside the bezel,
// so large panels only filter an edge ring and paint the middle as plain tint.
const RING_MIN_AREA = 100_000;
const RING_MARGIN = 4;
const ring = computed(() => {
  const w = panelWidth.value;
  const h = panelHeight.value;
  if (w * h < RING_MIN_AREA) return null;
  const bezel = Math.min(
    Math.max(2, Math.min(w, h) / 2 - 1),
    Math.max(1, props.bezelWidth * 1.22),
  );
  const edge = Math.ceil(Math.max(radius.value, bezel) + RING_MARGIN);
  const side = Math.ceil(bezel + RING_MARGIN);
  if (edge * 2 >= h || side * 2 >= w) return null;
  return { w, h, edge, side };
});
const ringRegions = computed(() => {
  const r = ring.value;
  if (!r) return undefined;
  return [
    { id: `${filterId}-t`, x: 0, y: 0 },
    { id: `${filterId}-b`, x: 0, y: r.h - r.edge },
    { id: `${filterId}-l`, x: 0, y: r.edge },
    { id: `${filterId}-r`, x: r.w - r.side, y: r.edge },
  ];
});
const ringStyles = computed<CSSProperties[]>(() => {
  const r = ring.value;
  if (!r) return [];
  const edge = `${r.edge}px`;
  const side = `${r.side}px`;
  const corner = `${radius.value}px`;
  const tint = {
    position: "absolute" as const,
    backgroundColor: props.backgroundColor,
    opacity: props.backgroundOpacity,
  };
  const glass = (id: string) => ({
    ...tint,
    backdropFilter: `url(#${id})`,
    WebkitBackdropFilter: `url(#${id})`,
  });
  return [
    { ...glass(`${filterId}-t`), left: 0, right: 0, top: 0, height: edge, borderTopLeftRadius: corner, borderTopRightRadius: corner },
    { ...glass(`${filterId}-b`), left: 0, right: 0, bottom: 0, height: edge, borderBottomLeftRadius: corner, borderBottomRightRadius: corner },
    { ...glass(`${filterId}-l`), left: 0, top: edge, bottom: edge, width: side },
    { ...glass(`${filterId}-r`), right: 0, top: edge, bottom: edge, width: side },
    { ...tint, left: side, right: side, top: edge, bottom: edge },
  ];
});
const ringShadowStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  borderRadius: `${radius.value}px`,
  pointerEvents: "none",
  opacity: props.backgroundOpacity,
  boxShadow: props.shadow,
}));

const innerInset = computed(() => Math.max(props.gradientBlurSize - 20, 20));
const rootStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  borderRadius: `${radius.value}px`,
  border: `${props.borderWidth}px solid ${props.borderColor}`,
  opacity: props.disabled ? 0.5 : 1,
  visibility: hasMeasuredPanel.value ? "visible" : "hidden",
  cursor: props.disabled ? "not-allowed" : undefined,
}));
const glassStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  borderRadius: `${radius.value}px`,
  backdropFilter: `url(#${filterId})`,
  WebkitBackdropFilter: `url(#${filterId})`,
  backgroundColor: props.backgroundColor,
  opacity: props.backgroundOpacity,
  boxShadow: props.shadow,
}));
// Keep the highlight out of the SVG filter: filter primitives re-run on every scroll frame.
const specularUrl = ref("");
const specularStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  borderRadius: `${radius.value}px`,
  pointerEvents: "none",
  backgroundImage: `url(${specularUrl.value})`,
  backgroundSize: "100% 100%",
  opacity: props.specularOpacity * props.backgroundOpacity,
}));
const centerBlurStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  top: `${innerInset.value}px`,
  bottom: `${innerInset.value}px`,
  left: `${innerInset.value}px`,
  right: `${innerInset.value}px`,
  backdropFilter: `blur(${props.centerBlurAmount}px)`,
  WebkitBackdropFilter: `blur(${props.centerBlurAmount}px)`,
}));
const hoverOverlayStyle = computed<CSSProperties>(() => ({
  ...hoverStyle.value,
  borderRadius: `${radius.value}px`,
  overflow: "hidden",
  zIndex: 50,
}));
const contentStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  boxSizing: "border-box",
  zIndex: 99,
  padding: props.contentPadding,
  overflowX: "hidden",
  overflowY: props.contentOverflowY,
}));
</script>

<template>
  <div ref="containerRef" :style="rootStyle">
    <!-- SVG filter definition -->
    <LiquidGlassFilter
      v-if="hasMeasuredPanel"
      :id="filterId"
      :width="panelWidth"
      :height="panelHeight"
      :radius="radius"
      :bezel-width="bezelWidth"
      :glass-thickness="glassThickness"
      :refractive-index="hoverRefractiveIndex"
      :bezel-type="bezelType"
      :shape="shape"
      :corner-radius="cornerRadius"
      :squircle-exponent="squircleExponent"
      :quality="quality"
      :blur="blur"
      :scale-ratio="scaleRatio"
      :specular-opacity="specularOpacity"
      :specular-saturation="specularSaturation"
      :specular-angle="specularAngle"
      :magnify="magnify"
      :magnifying-scale="magnifyingScale"
      :scroll-fast="scrollFast"
      :inline-specular="false"
      :regions="ringRegions"
      @specular="specularUrl = $event"
    />

    <!-- Glass background with refraction filter -->
    <template v-if="ring">
      <div v-for="(style, i) in ringStyles" :key="i" :style="style" />
      <div v-if="shadow !== 'none'" :style="ringShadowStyle" />
    </template>
    <div v-else :style="glassStyle" />
    <div v-if="specularUrl && specularOpacity > 0" :style="specularStyle" />

    <!-- Progressive gradient blur edges. Size 0 still mounts 32 backdrop layers. -->
    <template v-if="gradientBlurSize > 0">
      <GradientBlur direction="top" :size="gradientBlurSize" />
      <GradientBlur direction="bottom" :size="gradientBlurSize" />
      <GradientBlur direction="left" :size="gradientBlurSize" />
      <GradientBlur direction="right" :size="gradientBlurSize" />
    </template>

    <!-- Center backdrop blur (between gradient-blur edges) -->
    <div v-if="centerBlurAmount > 0" :style="centerBlurStyle" />

    <!-- Hover light overlay -->
    <div v-if="hoverLight" :style="hoverOverlayStyle" />

    <!-- Content slot -->
    <div :style="contentStyle">
      <slot />
    </div>
  </div>
</template>
