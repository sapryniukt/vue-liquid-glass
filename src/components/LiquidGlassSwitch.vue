<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  useId,
  type CSSProperties,
} from "vue";
import {
  useGlassHover,
  type GlassHoverOptions,
} from "../composables/useGlassHover";
import LiquidGlassFilter from "./LiquidGlassFilter.vue";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    size?: "xs" | "small" | "medium" | "large";
    disabled?: boolean;
    restScale?: number;
    activeScale?: number;
    pressLerp?: number;
    dragOverflowDamping?: number;
    releaseDelayMs?: number;
    clickThresholdPx?: number;
    thumbFilterBlur?: number;
    thumbFilterSpecularOpacity?: number;
    thumbFilterSpecularSaturation?: number;
    trackFilterBezelWidth?: number;
    trackFilterGlassThickness?: number;
    trackFilterBlur?: number;
    trackFilterScaleRatio?: number;
    trackFilterSpecularOpacity?: number;
    trackFilterSpecularSaturation?: number;
    trackRefractiveIndexBase?: number;
    trackRefractiveIndexHoverBoost?: number;
    thumbRefractiveIndexBase?: number;
    thumbRefractiveIndexHoverBoost?: number;
    pressScaleRatioBase?: number;
    pressScaleRatioBoost?: number;
    trackInsetShadow?: string;
    hoverLight?: boolean;
    hoverLightOptions?: GlassHoverOptions;
  }>(),
  {
    modelValue: false,
    size: "medium",
    disabled: false,
    restScale: 0.65,
    activeScale: 0.9,
    pressLerp: 0.26,
    dragOverflowDamping: 22,
    releaseDelayMs: 420,
    clickThresholdPx: 4,
    thumbFilterBlur: 0.2,
    thumbFilterSpecularOpacity: 0.5,
    thumbFilterSpecularSaturation: 6,
    trackFilterBezelWidth: 12,
    trackFilterGlassThickness: 80,
    trackFilterBlur: 1,
    trackFilterScaleRatio: 0.4,
    trackFilterSpecularOpacity: 0.4,
    trackFilterSpecularSaturation: 8,
    trackRefractiveIndexBase: 1.4,
    trackRefractiveIndexHoverBoost: 0.12,
    thumbRefractiveIndexBase: 1.5,
    thumbRefractiveIndexHoverBoost: 0.08,
    pressScaleRatioBase: 0.4,
    pressScaleRatioBoost: 0.5,
    trackInsetShadow:
      "var(--lg-switch-track-inset, inset 0 0 10px rgba(255,255,255,0.08))",
    hoverLight: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const sizePresets = {
  xs: {
    sliderWidth: 70,
    sliderHeight: 30,
    thumbWidth: 64,
    thumbHeight: 40,
    thumbScale: 0.65,
    bezelWidth: 8,
    glassThickness: 10,
  },
  small: {
    sliderWidth: 58,
    sliderHeight: 24,
    thumbWidth: 53,
    thumbScale: 0.65,
    thumbHeight: 31,
    bezelWidth: 7,
    glassThickness: 9,
  },
  medium: {
    sliderWidth: 76,
    sliderHeight: 32,
    thumbWidth: 70,
    thumbHeight: 43,
    thumbScale: 0.65,
    bezelWidth: 9,
    glassThickness: 12,
  },
  large: {
    sliderWidth: 95,
    sliderHeight: 40,
    thumbWidth: 87,
    thumbHeight: 55,
    thumbScale: 0.65,
    bezelWidth: 12,
    glassThickness: 14,
  },
};

const dimensions = computed(() => sizePresets[props.size]);
const sliderWidth = computed(() => dimensions.value.sliderWidth);
const sliderHeight = computed(() => dimensions.value.sliderHeight);
const thumbWidth = computed(() => dimensions.value.thumbWidth);
const thumbHeight = computed(() => dimensions.value.thumbHeight);
const thumbRadius = computed(() => thumbHeight.value / 2);
const bezelWidth = computed(() => dimensions.value.bezelWidth);
const glassThickness = computed(() => dimensions.value.glassThickness);

const trackRef = ref<HTMLElement | null>(null);
const filterId = `lg-switch-${useId()}`;
const trackFilterId = `lg-switch-track-${useId()}`;
const { hoverStyle: switchHoverStyle, hoverProgress: switchHoverProgress } =
  useGlassHover(trackRef, props.hoverLightOptions);

const THUMB_REST_SCALE = computed(() => props.restScale);
const THUMB_ACTIVE_SCALE = computed(() => props.activeScale);
const TRACK_INSET_PX = 2;
const THUMB_REST_OFFSET = computed(
  () => ((1 - THUMB_REST_SCALE.value) * thumbWidth.value) / 2,
);
const TRAVEL = computed(
  () => sliderWidth.value - thumbWidth.value * THUMB_REST_SCALE.value - TRACK_INSET_PX * 2,
);

const internalChecked = ref(props.modelValue);
const pointerDown = ref(0);
const xDragRatio = ref(props.modelValue ? 1 : 0);
const initialPointerX = ref(0);
const pressProgress = ref(0);
let pressAnimationFrame: number | null = null;
let glassReleaseTimeout: ReturnType<typeof setTimeout> | null = null;

const stopPressAnimation = () => {
  if (pressAnimationFrame !== null) {
    cancelAnimationFrame(pressAnimationFrame);
    pressAnimationFrame = null;
  }
};

const clearGlassReleaseTimeout = () => {
  if (glassReleaseTimeout) {
    clearTimeout(glassReleaseTimeout);
    glassReleaseTimeout = null;
  }
};

const animatePressProgressTo = (target: number) => {
  stopPressAnimation();
  const tick = () => {
    const current = pressProgress.value;
    const next = current + (target - current) * props.pressLerp;
    pressProgress.value = next;
    if (Math.abs(target - next) < 0.001) {
      pressProgress.value = target;
      pressAnimationFrame = null;
      return;
    }
    pressAnimationFrame = requestAnimationFrame(tick);
  };
  pressAnimationFrame = requestAnimationFrame(tick);
};

watch(
  () => props.modelValue,
  (newVal) => {
    internalChecked.value = newVal;
    if (pointerDown.value === 0) {
      xDragRatio.value = newVal ? 1 : 0;
    }
  },
);

const isActive = computed(() => pointerDown.value > 0.5);

watch(
  () => pointerDown.value > 0.5,
  (active) => {
    animatePressProgressTo(active ? 1 : 0);
  },
  { immediate: true },
);

const thumbScale = computed(
  () =>
    THUMB_REST_SCALE.value +
    (THUMB_ACTIVE_SCALE.value - THUMB_REST_SCALE.value) *
      (isActive.value ? 1 : 0),
);

const backgroundOpacity = computed(() => 1 - 0.9 * pressProgress.value);
const thumbShadow = computed(() => {
  const p = pressProgress.value;
  const outer = 0.1 + p * 0.02;
  const inset = p * 0.09;
  return `0 4px 22px rgba(var(--lg-switch-shadow-rgb, 0,0,0),${outer}), inset 2px 7px 24px rgba(var(--lg-switch-shadow-rgb, 0,0,0),${inset}), inset -2px -7px 24px rgba(var(--lg-switch-highlight-rgb, 255,255,255),${inset})`;
});

const scaleRatio = computed(
  () =>
    props.pressScaleRatioBase +
    props.pressScaleRatioBoost * pressProgress.value,
);
const trackRefractiveIndex = computed(
  () =>
    props.trackRefractiveIndexBase +
    switchHoverProgress.value * props.trackRefractiveIndexHoverBoost,
);
const thumbRefractiveIndex = computed(
  () =>
    props.thumbRefractiveIndexBase +
    switchHoverProgress.value * props.thumbRefractiveIndexHoverBoost,
);

const backgroundColor = computed(() => {
  const ratio = xDragRatio.value;
  const r = Math.round(148 + (59 - 148) * ratio);
  const g = Math.round(148 + (191 - 148) * ratio);
  const b = Math.round(159 + (78 - 159) * ratio);
  // Keep track visible even on noisy backgrounds.
  const a = Math.round(175 + (238 - 175) * ratio);
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
});

const trackBorderColor = computed(() => {
  const ratio = xDragRatio.value;
  const r = Math.round(148 + (59 - 148) * ratio);
  const g = Math.round(148 + (191 - 148) * ratio);
  const b = Math.round(159 + (78 - 159) * ratio);
  return `rgba(${r}, ${g}, ${b}, 0.88)`;
});

const thumbX = computed(() => xDragRatio.value * TRAVEL.value);

const thumbMarginLeft = computed(
  () => TRACK_INSET_PX - THUMB_REST_OFFSET.value,
);

const rootStyle = computed<CSSProperties>(() => ({
  display: "inline-block",
  userSelect: "none",
  touchAction: "none",
  opacity: props.disabled ? 0.5 : 1,
  cursor: props.disabled ? "not-allowed" : undefined,
}));

const trackStyle = computed<CSSProperties>(() => ({
  position: "relative",
  cursor: "pointer",
  transition: "background-color 0.15s",
  width: `${sliderWidth.value}px`,
  height: `${sliderHeight.value}px`,
  backgroundColor: backgroundColor.value,
  borderRadius: `${sliderHeight.value / 2}px`,
}));

const trackGlassStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  borderRadius: `${sliderHeight.value / 2}px`,
  backdropFilter: `url(#${trackFilterId})`,
  WebkitBackdropFilter: `url(#${trackFilterId})`,
  backgroundColor: backgroundColor.value,
  border: `1px solid ${trackBorderColor.value}`,
  boxShadow: props.trackInsetShadow,
}));

const switchHoverOverlayStyle = computed<CSSProperties>(() => ({
  ...switchHoverStyle.value,
  borderRadius: `${sliderHeight.value / 2}px`,
  overflow: "hidden",
}));

const thumbStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  cursor: "pointer",
  transition:
    pointerDown.value > 0.5
      ? "transform 60ms linear"
      : "transform 460ms cubic-bezier(0.22, 1, 0.36, 1), background-color 240ms ease, box-shadow 240ms ease",
  height: `${thumbHeight.value}px`,
  width: `${thumbWidth.value}px`,
  marginLeft: `${thumbMarginLeft.value}px`,
  transform: `translateX(${thumbX.value}px) translateY(-50%) scale(${thumbScale.value})`,
  top: `${sliderHeight.value / 2}px`,
  borderRadius: `${thumbRadius.value}px`,
  backdropFilter: `url(#${filterId})`,
  WebkitBackdropFilter: `url(#${filterId})`,
  backgroundColor: `rgba(var(--lg-switch-thumb-rgb, 255,255,255), ${backgroundOpacity.value})`,
  boxShadow: thumbShadow.value,
}));

const handleThumbPointerDown = (e: MouseEvent | TouchEvent) => {
  if (props.disabled) return;
  clearGlassReleaseTimeout();
  pointerDown.value = 1;
  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  initialPointerX.value = clientX;
};

const handlePointerMove = (e: PointerEvent | TouchEvent | MouseEvent) => {
  if (pointerDown.value === 0 || props.disabled) return;
  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  const baseRatio = internalChecked.value ? 1 : 0;
  const displacementX = clientX - initialPointerX.value;
  const ratio = baseRatio + displacementX / TRAVEL.value;

  const overflow = ratio < 0 ? -ratio : ratio > 1 ? ratio - 1 : 0;
  const overflowSign = ratio < 0 ? -1 : 1;
  const dampedOverflow = (overflowSign * overflow) / props.dragOverflowDamping;

  xDragRatio.value = Math.min(1, Math.max(0, ratio)) + dampedOverflow;
};

const handlePointerUp = (e: PointerEvent | TouchEvent | MouseEvent) => {
  if (pointerDown.value === 0) return;
  pointerDown.value = 0;

  const clientX =
    "changedTouches" in e ? e.changedTouches[0].clientX : e.clientX;

  const distance = clientX - initialPointerX.value;

  if (Math.abs(distance) > props.clickThresholdPx) {
    const shouldBeChecked = xDragRatio.value > 0.5;
    internalChecked.value = shouldBeChecked;
    xDragRatio.value = shouldBeChecked ? 1 : 0;
    emit("update:modelValue", shouldBeChecked);
  } else {
    const newValue = !internalChecked.value;
    internalChecked.value = newValue;
    xDragRatio.value = newValue ? 1 : 0;
    emit("update:modelValue", newValue);
  }

  // Keep glass state active during click-toggle travel, then fade out.
  animatePressProgressTo(1);
  clearGlassReleaseTimeout();
  glassReleaseTimeout = setTimeout(() => {
    if (pointerDown.value === 0) animatePressProgressTo(0);
  }, props.releaseDelayMs);
};

onMounted(() => {
  window.addEventListener("mouseup", handlePointerUp);
  window.addEventListener("touchend", handlePointerUp);
});

onUnmounted(() => {
  stopPressAnimation();
  clearGlassReleaseTimeout();
  window.removeEventListener("mouseup", handlePointerUp);
  window.removeEventListener("touchend", handlePointerUp);
});
</script>

<template>
  <div
    :style="rootStyle"
    @mousemove="handlePointerMove"
    @touchmove="handlePointerMove"
  >
    <div ref="trackRef" :style="trackStyle">
      <LiquidGlassFilter
        :id="trackFilterId"
        :width="sliderWidth"
        :height="sliderHeight"
        :radius="sliderHeight / 2"
        :bezel-width="trackFilterBezelWidth"
        :glass-thickness="trackFilterGlassThickness"
        :refractive-index="trackRefractiveIndex"
        bezel-type="convex_squircle"
        shape="pill"
        :blur="trackFilterBlur"
        :scale-ratio="trackFilterScaleRatio"
        :specular-opacity="trackFilterSpecularOpacity"
        :specular-saturation="trackFilterSpecularSaturation"
      />

      <div :style="trackGlassStyle" />

      <!-- Hover light overlay -->
      <div v-if="hoverLight" :style="switchHoverOverlayStyle" />

      <LiquidGlassFilter
        :id="filterId"
        :width="thumbWidth"
        :height="thumbHeight"
        :radius="thumbRadius"
        :bezel-width="bezelWidth"
        :glass-thickness="glassThickness"
        :refractive-index="thumbRefractiveIndex"
        bezel-type="lip"
        shape="pill"
        :blur="thumbFilterBlur"
        :scale-ratio="scaleRatio"
        :specular-opacity="thumbFilterSpecularOpacity"
        :specular-saturation="thumbFilterSpecularSaturation"
      />

      <div
        :style="thumbStyle"
        @mousedown="handleThumbPointerDown"
        @touchstart="handleThumbPointerDown"
      />
    </div>
  </div>
</template>
