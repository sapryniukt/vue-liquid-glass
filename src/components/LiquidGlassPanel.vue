<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
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
  class?: any;
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
  hoverLight: true,
});

const containerRef = ref<HTMLElement | null>(null);
const { hoverStyle, hoverProgress } = useGlassHover(
  containerRef,
  props.hoverLightOptions,
);
const panelWidth = ref(300);
const panelHeight = ref(200);
const hasMeasuredPanel = ref(false);

const filterId = `lg-panel-${Math.random().toString(36).substring(2, 8)}`;

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    if (!containerRef.value) return;
    panelWidth.value = containerRef.value.offsetWidth;
    panelHeight.value = containerRef.value.offsetHeight;
    hasMeasuredPanel.value = panelWidth.value > 0 && panelHeight.value > 0;

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        panelWidth.value = entry.contentRect.width;
        panelHeight.value = entry.contentRect.height;
        if (
          !hasMeasuredPanel.value &&
          panelWidth.value > 0 &&
          panelHeight.value > 0
        ) {
          hasMeasuredPanel.value = true;
        }
      }
    });
    resizeObserver.observe(containerRef.value);
  });
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

const innerInset = computed(() => Math.max(props.gradientBlurSize - 20, 20));
const rootStyle = computed<CSSProperties>(() => ({
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
  position: "relative",
  zIndex: 99,
  padding: props.contentPadding,
  width: "100%",
  height: "100%",
  overflowX: "hidden",
  overflowY: props.contentOverflowY,
}));
</script>

<template>
  <div ref="containerRef" :class="['lg-panel-root', props.class]" :style="rootStyle">
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
    />

    <!-- Glass background with refraction filter -->
    <div :style="glassStyle" />

    <!-- Progressive gradient blur edges -->
    <GradientBlur direction="top" :size="gradientBlurSize" />
    <GradientBlur direction="bottom" :size="gradientBlurSize" />
    <GradientBlur direction="left" :size="gradientBlurSize" />
    <GradientBlur direction="right" :size="gradientBlurSize" />

    <!-- Center backdrop blur (between gradient-blur edges) -->
    <div :style="centerBlurStyle" />

    <!-- Hover light overlay -->
    <div v-if="hoverLight" :style="hoverOverlayStyle" />

    <!-- Content slot -->
    <div :style="contentStyle">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.lg-panel-root {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
