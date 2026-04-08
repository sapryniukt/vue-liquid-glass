<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
  type CSSProperties,
} from "vue";
import {
  useGlassHover,
  type GlassHoverOptions,
} from "../composables/useGlassHover";
import LiquidGlassFilter from "./LiquidGlassFilter.vue";

const props = withDefaults(
  defineProps<{
    modelValue?: number;
    min?: number;
    max?: number;
    size?: "small" | "medium" | "large";
    disabled?: boolean;
    // Interaction tuning
    restScale?: number;
    dragScale?: number;
    dragOpacity?: number;
    restOpacity?: number;
    thumbTransition?: string;
    // Track filter tuning
    trackFilterBezelWidth?: number;
    trackFilterGlassThickness?: number;
    trackFilterBlur?: number;
    trackFilterScaleRatio?: number;
    trackFilterSpecularOpacity?: number;
    trackFilterSpecularSaturation?: number;
    // Thumb filter tuning
    thumbFilterBlur?: number;
    thumbFilterScaleRatioBoost?: number;
    thumbFilterSpecularOpacity?: number;
    thumbFilterSpecularSaturation?: number;
    thumbFilterSpecularSaturationBoost?: number;
    // Optics tuning
    trackCurvatureBoost?: number;
    thumbCurvatureBoost?: number;
    trackRefractiveIndexBase?: number;
    trackRefractiveIndexHoverBoost?: number;
    thumbRefractiveIndexBase?: number;
    thumbRefractiveIndexHoverBoost?: number;
    trackScaleRatioBoost?: number;
    trackSpecularSaturationBoost?: number;
    // Misc
    initialContainerWidth?: number;
    hoverLight?: boolean;
    hoverLightOptions?: GlassHoverOptions;
  }>(),
  {
    modelValue: 0,
    min: 0,
    max: 100,
    size: "medium",
    disabled: false,
    restScale: 0.6,
    dragScale: 1,
    dragOpacity: 0.1,
    restOpacity: 1,
    thumbTransition: "transform 0.15s ease-out",
    trackFilterBezelWidth: 12,
    trackFilterGlassThickness: 90,
    trackFilterBlur: 0.35,
    trackFilterScaleRatio: 0.75,
    trackFilterSpecularOpacity: 0.38,
    trackFilterSpecularSaturation: 7,
    thumbFilterBlur: 0,
    thumbFilterScaleRatioBoost: 1.55,
    thumbFilterSpecularOpacity: 0.4,
    thumbFilterSpecularSaturation: 7,
    thumbFilterSpecularSaturationBoost: 4,
    trackCurvatureBoost: 1.32,
    thumbCurvatureBoost: 1.4,
    trackRefractiveIndexBase: 1.62,
    trackRefractiveIndexHoverBoost: 0.18,
    thumbRefractiveIndexBase: 1.65,
    thumbRefractiveIndexHoverBoost: 0.12,
    trackScaleRatioBoost: 1.45,
    trackSpecularSaturationBoost: 3,
    initialContainerWidth: 300,
    hoverLight: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const sizePresets = {
  small: {
    sliderHeight: 10,
    thumbWidth: 54,
    thumbHeight: 36,
    thumbRadius: 18,
    bezelWidth: 30,
    glassThickness: 30,
  },
  medium: {
    sliderHeight: 14,
    thumbWidth: 90,
    thumbHeight: 60,
    thumbRadius: 30,
    bezelWidth: 40,
    glassThickness: 40,
  },
  large: {
    sliderHeight: 18,
    thumbWidth: 126,
    thumbHeight: 84,
    thumbRadius: 42,
    bezelWidth: 50,
    glassThickness: 40,
  },
};

const containerRef = ref<HTMLElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);
const containerWidth = ref(props.initialContainerWidth);

const dimensions = computed(() => sizePresets[props.size]);
const sliderWidth = computed(() => containerWidth.value);
const sliderHeight = computed(() => dimensions.value.sliderHeight);
const thumbWidth = computed(() => dimensions.value.thumbWidth);
const thumbHeight = computed(() => dimensions.value.thumbHeight);
const thumbRadius = computed(() => dimensions.value.thumbRadius);
const bezelWidth = computed(() => dimensions.value.bezelWidth);
const glassThickness = computed(() => dimensions.value.glassThickness);

const filterId = `lg-slider-${Math.random().toString(36).substring(2, 9)}`;
const trackFilterId = `lg-slider-track-${Math.random().toString(36).substring(2, 9)}`;
const { hoverStyle: sliderHoverStyle, hoverProgress: sliderHoverProgress } =
  useGlassHover(trackRef, props.hoverLightOptions);

const internalValue = ref(props.modelValue);

watch(
  () => props.modelValue,
  (newVal) => {
    internalValue.value = newVal;
  },
);

const pointerDown = ref(0);
const isUp = computed(() => (pointerDown.value > 0.5 ? 1 : 0));

const pressMultiplier = computed(() => (isUp.value === 1 ? 0.9 : 0.4));
const scaleRatio = computed(() => pressMultiplier.value);
const scaleSpring = computed(() =>
  isUp.value === 1 ? props.dragScale : props.restScale,
);
const backgroundOpacity = computed(() =>
  isUp.value === 1 ? props.dragOpacity : props.restOpacity,
);

const thumbX = ref(0);

const updateThumbFromValue = () => {
  const range = sliderWidth.value - thumbWidth.value;
  if (range <= 0) return;
  const normalizedValue =
    (internalValue.value - props.min) / (props.max - props.min);
  thumbX.value = normalizedValue * range;
};

let resizeObserver: ResizeObserver | null = null;

const setupResizeObserver = () => {
  if (!containerRef.value) return;

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      containerWidth.value = entry.contentRect.width;
      nextTick(() => updateThumbFromValue());
    }
  });

  resizeObserver.observe(containerRef.value);
  containerWidth.value = containerRef.value.offsetWidth;
  updateThumbFromValue();
};

onMounted(() => {
  setupResizeObserver();
});

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect();
});

watch([internalValue, () => props.size], updateThumbFromValue);

let isDragging = false;
let startX = 0;
let startThumbX = 0;

const handlePointerDown = (e: PointerEvent) => {
  if (props.disabled) return;

  isDragging = true;
  pointerDown.value = 1;
  startX = e.clientX;
  startThumbX = thumbX.value;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
};

const handlePointerMove = (e: PointerEvent) => {
  if (!isDragging || props.disabled) return;

  const deltaX = e.clientX - startX;
  const maxThumbX = sliderWidth.value - thumbWidth.value;
  const newThumbX = Math.max(0, Math.min(maxThumbX, startThumbX + deltaX));
  thumbX.value = newThumbX;

  const range = sliderWidth.value - thumbWidth.value;
  const normalizedValue = thumbX.value / range;
  const newValue = props.min + normalizedValue * (props.max - props.min);
  internalValue.value = newValue;
  emit("update:modelValue", newValue);
};

const handlePointerUp = () => {
  isDragging = false;
  pointerDown.value = 0;
};

onMounted(() => {
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("mouseup", handlePointerUp);
  window.addEventListener("touchend", handlePointerUp);
});

onUnmounted(() => {
  window.removeEventListener("pointerup", handlePointerUp);
  window.removeEventListener("mouseup", handlePointerUp);
  window.removeEventListener("touchend", handlePointerUp);
});

const fillWidth = computed(() =>
  Math.max(
    0,
    thumbX.value +
      thumbWidth.value / 2 -
      (thumbWidth.value * (1 - props.restScale)) / 2,
  ),
);
const trackRefractiveIndex = computed(
  () =>
    props.trackRefractiveIndexBase +
    sliderHoverProgress.value * props.trackRefractiveIndexHoverBoost,
);
const thumbRefractiveIndex = computed(
  () =>
    props.thumbRefractiveIndexBase +
    sliderHoverProgress.value * props.thumbRefractiveIndexHoverBoost,
);
const trackScaleRatioBoosted = computed(
  () => props.trackFilterScaleRatio * props.trackScaleRatioBoost,
);
const thumbScaleRatioBoosted = computed(
  () => scaleRatio.value * props.thumbFilterScaleRatioBoost,
);
const trackHorizontalInset = computed(
  () => (thumbWidth.value * (1 - props.restScale)) / 2,
);
const trackWidth = computed(
  () => sliderWidth.value - thumbWidth.value * (1 - props.restScale),
);
const containerStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "100%",
  height: `${thumbHeight.value}px`,
  opacity: props.disabled ? 0.5 : 1,
  cursor: props.disabled ? "not-allowed" : undefined,
}));
const trackStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  cursor: props.disabled ? "not-allowed" : "pointer",
  height: `${sliderHeight.value}px`,
  top: `${(thumbHeight.value - sliderHeight.value) / 2}px`,
  left: `${trackHorizontalInset.value}px`,
  right: `${trackHorizontalInset.value}px`,
  backgroundColor: "var(--lg-slider-track-base, rgba(137, 137, 143, 0.72))",
  borderRadius: `${sliderHeight.value / 2}px`,
}));
const trackGlassStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  borderRadius: `${sliderHeight.value / 2}px`,
  backdropFilter: `url(#${trackFilterId})`,
  WebkitBackdropFilter: `url(#${trackFilterId})`,
  backgroundColor: "var(--lg-slider-track-overlay, rgba(137, 137, 143, 0.56))",
  border: "1px solid var(--lg-slider-track-border, rgba(255,255,255,0.12))",
  boxShadow:
    "var(--lg-slider-track-inset, inset 0 0 14px rgba(255,255,255,0.12))",
}));
const fillStyle = computed<CSSProperties>(() => ({
  height: `${sliderHeight.value}px`,
  width: `${fillWidth.value}px`,
  borderRadius: `${sliderHeight.value / 2}px`,
  backgroundColor: "var(--lg-slider-fill, #0377F7)",
  boxShadow: "var(--lg-slider-fill-glow, 0 0 10px rgba(3,119,247,0.45))",
  filter: "saturate(1.1) contrast(1.06)",
}));
const thumbStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  transition: props.thumbTransition,
  cursor: props.disabled ? "not-allowed" : "pointer",
  height: `${thumbHeight.value}px`,
  width: `${thumbWidth.value}px`,
  top: "50%",
  left: `${thumbX.value + thumbWidth.value / 2}px`,
  borderRadius: `${thumbRadius.value}px`,
  backdropFilter: `url(#${filterId})`,
  WebkitBackdropFilter: `url(#${filterId})`,
  transform: `translate(-50%, -50%) scale(${scaleSpring.value})`,
  transformOrigin: "center center",
  backgroundColor: `rgba(var(--lg-slider-thumb-rgb, 255,255,255), ${backgroundOpacity.value})`,
  boxShadow: "var(--lg-slider-thumb-shadow, 0 3px 14px rgba(0,0,0,0.1))",
}));
const hoverOverlayStyle = computed<CSSProperties>(() => ({
  ...sliderHoverStyle.value,
  borderRadius: `${sliderHeight.value / 2}px`,
  overflow: "hidden",
}));
const fillMaskStyle = computed<CSSProperties>(() => ({
  width: "100%",
  height: "100%",
  overflow: "hidden",
  borderRadius: `${sliderHeight.value / 2}px`,
}));
</script>

<template>
  <div ref="containerRef" :style="containerStyle">
    <!-- Track -->
    <div ref="trackRef" :style="trackStyle">
      <LiquidGlassFilter
        :id="trackFilterId"
        :width="trackWidth"
        :height="sliderHeight"
        :radius="sliderHeight / 2"
        :curvature-boost="trackCurvatureBoost"
        :bezel-width="trackFilterBezelWidth"
        :glass-thickness="trackFilterGlassThickness"
        :refractive-index="trackRefractiveIndex"
        bezel-type="convex_squircle"
        shape="pill"
        :blur="trackFilterBlur"
        :scale-ratio="trackScaleRatioBoosted"
        :specular-opacity="trackFilterSpecularOpacity"
        :specular-saturation="trackFilterSpecularSaturation + trackSpecularSaturationBoost"
      />

      <div :style="trackGlassStyle" />

      <!-- Hover light overlay -->
      <div
        v-if="hoverLight"
        :style="hoverOverlayStyle"
      />

      <div :style="fillMaskStyle">
        <!-- Blue fill -->
        <div :style="fillStyle" />
      </div>
    </div>

    <!-- SVG Filter -->
    <LiquidGlassFilter
      :id="filterId"
      :width="thumbWidth"
      :height="thumbHeight"
      :radius="thumbRadius"
      :curvature-boost="thumbCurvatureBoost"
      :bezel-width="bezelWidth"
      :glass-thickness="glassThickness"
      :refractive-index="thumbRefractiveIndex"
      bezel-type="convex_squircle"
      shape="pill"
      :blur="thumbFilterBlur"
      :scale-ratio="thumbScaleRatioBoosted"
      :specular-opacity="thumbFilterSpecularOpacity"
      :specular-saturation="thumbFilterSpecularSaturation + thumbFilterSpecularSaturationBoost"
    />

    <!-- Thumb -->
    <div
      :style="thumbStyle"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
    />
  </div>
</template>
