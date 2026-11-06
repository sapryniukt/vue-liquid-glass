<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
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
    modelValue?: string;
    placeholder?: string;
    size?: "xs" | "small" | "medium" | "large";
    disabled?: boolean;
    clearButtonGap?: number;
    expandScale?: number;
    inputScaleMin?: number;
    inputFilterBlur?: number;
    inputFilterScaleRatio?: number;
    inputSpecularOpacity?: number;
    inputSpecularSaturation?: number;
    orbFilterBlur?: number;
    orbFilterScaleRatio?: number;
    orbSpecularOpacity?: number;
    orbSpecularSaturation?: number;
    orbRestScale?: number;
    orbActiveScale?: number;
    inputRefractiveIndex?: number;
    orbRefractiveIndex?: number;
    hoverLight?: boolean;
    hoverLightOptions?: GlassHoverOptions;
  }>(),
  {
    modelValue: "",
    placeholder: "Search...",
    size: "medium",
    disabled: false,
    clearButtonGap: 18,
    expandScale: 1.02,
    inputScaleMin: 0.7,
    inputFilterBlur: 2,
    inputFilterScaleRatio: 0.4,
    inputSpecularOpacity: 0.4,
    inputSpecularSaturation: 4,
    orbFilterBlur: 1,
    orbFilterScaleRatio: 0.2,
    orbSpecularOpacity: 0.4,
    orbSpecularSaturation: 10,
    orbRestScale: 0.5,
    orbActiveScale: 1.3,
    inputRefractiveIndex: 1.45,
    orbRefractiveIndex: 1.4,
    hoverLight: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  focus: [];
  blur: [];
}>();

const sizePresets = {
  xs: {
    height: 32,
    orbSize: 24,
    radius: 16,
    iconSize: 14,
    fontSize: 12,
    gap: 6,
    bezelWidth: 8,
    glassThickness: 40,
    translateX: 20,
  },
  small: {
    height: 40,
    orbSize: 32,
    radius: 20,
    iconSize: 16,
    fontSize: 13,
    gap: 8,
    bezelWidth: 12,
    glassThickness: 60,
    translateX: 25,
  },
  medium: {
    height: 52,
    orbSize: 42,
    radius: 26,
    iconSize: 20,
    fontSize: 15,
    gap: 12,
    bezelWidth: 12,
    glassThickness: 80,
    translateX: 31,
  },
  large: {
    height: 64,
    orbSize: 52,
    radius: 32,
    iconSize: 24,
    fontSize: 17,
    gap: 16,
    bezelWidth: 20,
    glassThickness: 100,
    translateX: 37,
  },
};

const inputRef = ref<HTMLInputElement | null>(null);
const inputContainerRef = ref<HTMLElement | null>(null);
const orbContainerRef = ref<HTMLElement | null>(null);
const { hoverStyle: searchHoverStyle, isHovering: isSearchHovering } =
  useGlassHover(inputContainerRef, props.hoverLightOptions);
const { hoverStyle: orbHoverStyle } = useGlassHover(orbContainerRef, {
  ...props.hoverLightOptions,
  baseBrightness: 0,
});
const dimensions = computed(() => sizePresets[props.size]);
const height = computed(() => dimensions.value.height);
const orbSize = computed(() => dimensions.value.orbSize);
const radius = computed(() => dimensions.value.radius);
const iconSize = computed(() => dimensions.value.iconSize);
const gap = computed(() => dimensions.value.gap);
const fontSize = computed(() => dimensions.value.fontSize);

const orbFilterId = `lg-search-orb-${useId()}`;
const inputFilterId = `lg-search-input-${useId()}`;

const query = computed({
  get: () => props.modelValue,
  set: (val: string) => emit("update:modelValue", val),
});

const focused = ref(false);
const inputWidth = ref(100);
const hasMeasuredInputWidth = ref(false);
let resizeObserver: ResizeObserver | null = null;
let resizeRaf: number | null = null;
let pendingWidth: number | null = null;

const hasQuery = computed(() => !!query.value);
const isExpanded = computed(() => focused.value || hasQuery.value);
const isTransitioning = ref(false);
let transitionTimeout: ReturnType<typeof setTimeout> | null = null;

watch(isExpanded, () => {
  isTransitioning.value = true;
  if (transitionTimeout) clearTimeout(transitionTimeout);
  transitionTimeout = setTimeout(() => {
    isTransitioning.value = false;
    if (inputContainerRef.value)
      inputWidth.value = inputContainerRef.value.offsetWidth;
  }, 550);
});

const showCloseOrb = computed(() => hasQuery.value);
const orbScale = computed(() =>
  showCloseOrb.value ? props.orbActiveScale : props.orbRestScale,
);
const orbOpacity = computed(() => (showCloseOrb.value ? 1 : 0));
const orbRightInset = computed(() => (height.value - orbSize.value) / 2);
const reservedRightSpace = computed(() =>
  showCloseOrb.value
    ? orbSize.value + orbRightInset.value + props.clearButtonGap
    : 0,
);
const effectiveReservedRightSpace = computed(() =>
  hasMeasuredInputWidth.value ? reservedRightSpace.value : 0,
);
const glassScaleX = computed(() => {
  const w = inputWidth.value || 1;
  return Math.max(
    props.inputScaleMin,
    (w - effectiveReservedRightSpace.value) / w,
  );
});
const contentRightInset = computed(() => effectiveReservedRightSpace.value);
const inputGlassReady = computed(
  () => hasMeasuredInputWidth.value && inputWidth.value > 0,
);
const inputRefractiveIndex = computed(() => props.inputRefractiveIndex);
const orbRefractiveIndex = computed(() => props.orbRefractiveIndex);

const rootStyle = computed<CSSProperties>(() => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  userSelect: "none",
  width: "100%",
  height: `${height.value}px`,
}));

const inputContainerStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  zIndex: "10",
  transition: "transform 260ms cubic-bezier(0.22,1,0.36,1)",
  transform: `scale(${isExpanded.value ? props.expandScale : 1})`,
  transformOrigin: "center center",
  willChange: "transform",
}));

const inputGlassStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  zIndex: "0",
  transition: "all 300ms",
  transform: `scaleX(${glassScaleX.value})`,
  transformOrigin: "left center",
  borderRadius: `${radius.value}px`,
  backdropFilter: inputGlassReady.value ? `url(#${inputFilterId})` : "none",
  WebkitBackdropFilter: inputGlassReady.value
    ? `url(#${inputFilterId})`
    : "none",
  backgroundColor: "var(--lg-search-input-bg, rgba(255,255,255,0.05))",
  boxShadow: isExpanded.value
    ? "var(--lg-search-input-shadow-expanded, 0 4px 24px rgba(0,0,0,0.1))"
    : "var(--lg-search-input-shadow, 0 2px 10px rgba(0,0,0,0.05))",
  willChange: "transform",
}));

const inputContentStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  top: "0",
  left: "0",
  bottom: "0",
  right: `${contentRightInset.value}px`,
  zIndex: "10",
  display: "flex",
  alignItems: "center",
  paddingLeft: `${radius.value * 0.8}px`,
  transition: "right 260ms cubic-bezier(0.22,1,0.36,1)",
}));

const orbButtonStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  border: "none",
  background: "transparent",
  padding: "0",
  borderRadius: `${orbSize.value / 2}px`,
  overflow: "hidden",
  appearance: "none",
  WebkitAppearance: "none",
  right: `${orbRightInset.value}px`,
  top: "50%",
  width: `${orbSize.value}px`,
  height: `${orbSize.value}px`,
  transform: `translateY(-50%) scale(${orbScale.value}) rotate(${showCloseOrb.value ? 0 : -90}deg)`,
  opacity: orbOpacity.value,
  pointerEvents: showCloseOrb.value ? "auto" : "none",
  zIndex: "20",
  cursor: "pointer",
  transition: "transform 500ms cubic-bezier(0.34,1.56,0.64,1)",
}));

const setupResizeObserver = () => {
  if (!inputContainerRef.value) return;
  resizeObserver = new ResizeObserver((entries) => {
    if (isTransitioning.value) return;
    const nextWidth = entries[0]?.contentRect.width;
    if (!nextWidth) return;

    // Always apply first meaningful measurement immediately.
    if (!hasMeasuredInputWidth.value) {
      inputWidth.value = nextWidth;
      hasMeasuredInputWidth.value = true;
      pendingWidth = null;
      if (resizeRaf !== null) {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = null;
      }
      return;
    }

    // Ignore sub-pixel noise to prevent unnecessary filter regeneration.
    if (Math.abs(nextWidth - inputWidth.value) < 1) return;

    pendingWidth = nextWidth;
    if (resizeRaf !== null) return;
    resizeRaf = requestAnimationFrame(() => {
      if (pendingWidth !== null) {
        inputWidth.value = pendingWidth;
        hasMeasuredInputWidth.value = true;
        pendingWidth = null;
      }
      resizeRaf = null;
    });
  });
  resizeObserver.observe(inputContainerRef.value);
  inputWidth.value = inputContainerRef.value.offsetWidth;
  hasMeasuredInputWidth.value = inputWidth.value > 0;
};

onMounted(() => {
  nextTick(setupResizeObserver);
});
onUnmounted(() => {
  resizeObserver?.disconnect();
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
  if (transitionTimeout) clearTimeout(transitionTimeout);
});

const handleFocus = () => {
  focused.value = true;
  emit("focus");
};
const handleBlur = () => {
  focused.value = false;
  emit("blur");
};
const focusInput = () => {
  if (!props.disabled) inputRef.value?.focus();
};
const clearSearch = () => {
  if (!props.disabled && showCloseOrb.value) {
    query.value = "";
    inputRef.value?.focus();
  }
};
</script>

<template>
  <div :style="rootStyle">
    <div ref="inputContainerRef" :style="inputContainerStyle">
      <LiquidGlassFilter
        v-if="inputGlassReady"
        :id="inputFilterId"
        :width="inputWidth"
        :height="height"
        :radius="radius"
        :bezel-width="dimensions.bezelWidth"
        :glass-thickness="dimensions.glassThickness"
        :refractive-index="inputRefractiveIndex"
        bezel-type="convex_squircle"
        shape="pill"
        :blur="inputFilterBlur"
        :scale-ratio="inputFilterScaleRatio"
        :specular-opacity="inputSpecularOpacity"
        :specular-saturation="inputSpecularSaturation"
      />

      <div :style="inputGlassStyle" />

      <!-- Hover light overlay -->
      <div
        v-if="hoverLight"
        :style="{
          ...searchHoverStyle,
          borderRadius: `${radius}px`,
          overflow: 'hidden',
          zIndex: '5',
          transform: `scaleX(${glassScaleX})`,
          transformOrigin: 'left center',
          transition: 'transform 300ms',
          willChange: 'transform',
        }"
      />

      <!-- Focus brightness overlay (matches hover base lift) -->
      <div
        v-if="hoverLight && focused && !isSearchHovering"
        :style="{
          position: 'absolute',
          inset: '0',
          zIndex: '4',
          borderRadius: `${radius}px`,
          overflow: 'hidden',
          transform: `scaleX(${glassScaleX})`,
          transformOrigin: 'left center',
          transition: 'transform 300ms, opacity 200ms',
          willChange: 'transform',
          pointerEvents: 'none',
          background:
            'linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.06))',
        }"
      />

      <div :style="inputContentStyle">
        <svg
          :style="{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            marginRight: `${gap}px`,
            flexShrink: '0',
            color: isExpanded
              ? 'var(--lg-search-icon-active, rgba(255,255,255,0.95))'
              : 'var(--lg-search-icon, rgba(255,255,255,0.6))',
            cursor: disabled ? 'default' : 'pointer',
          }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          @mousedown.prevent="focusInput"
          @click="focusInput"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          class="lg-search-input-field"
          ref="inputRef"
          v-model="query"
          type="text"
          :placeholder="placeholder"
          :disabled="disabled"
          :style="{
            flex: '1',
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--lg-search-text, rgba(255,255,255,0.92))',
            fontWeight: '500',
            fontSize: `${fontSize}px`,
            paddingRight: showCloseOrb ? `${orbSize + gap}px` : `${radius}px`,
            transition: 'padding 300ms',
          }"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </div>
    </div>

    <button
      type="button"
      :aria-disabled="disabled || !showCloseOrb"
      :tabindex="showCloseOrb && !disabled ? 0 : -1"
      aria-label="Clear search"
      ref="orbContainerRef"
      :style="orbButtonStyle"
      @mousedown.prevent
      @click="clearSearch"
    >
      <LiquidGlassFilter
        :id="orbFilterId"
        :width="orbSize"
        :height="orbSize"
        :radius="orbSize / 2"
        :bezel-width="dimensions.bezelWidth"
        :glass-thickness="dimensions.glassThickness"
        :refractive-index="orbRefractiveIndex"
        bezel-type="convex_squircle"
        shape="pill"
        :blur="orbFilterBlur"
        :scale-ratio="orbFilterScaleRatio"
        :specular-opacity="orbSpecularOpacity"
        :specular-saturation="orbSpecularSaturation"
      />

      <div
        :style="{
          position: 'absolute',
          inset: '0',
          zIndex: '10',
          borderRadius: `${orbSize / 2}px`,
          backdropFilter: `url(#${orbFilterId})`,
          WebkitBackdropFilter: `url(#${orbFilterId})`,
          backgroundColor: 'var(--lg-search-orb-bg, rgba(255,255,255,0.05))',
          boxShadow:
            'var(--lg-search-orb-shadow, 0 4px 15px rgba(0,0,0,0.1), inset 0 0 5px rgba(255,255,255,0.1))',
        }"
      />

      <!-- Stable orb enhancement (prevents delayed hover pop/glitch) -->
      <div
        :style="{
          position: 'absolute',
          inset: '0',
          zIndex: '14',
          borderRadius: `${orbSize / 2}px`,
          pointerEvents: 'none',
          background:
            'linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.06))',
          // Keep this layer fully present so it animates in sync with parent orb opacity/scale.
          opacity: 1,
          backdropFilter: 'saturate(1.08)',
          WebkitBackdropFilter: 'saturate(1.08)',
        }"
      />

      <div
        v-if="hoverLight"
        :style="{
          ...orbHoverStyle,
          borderRadius: `${orbSize / 2}px`,
          overflow: 'hidden',
          zIndex: '15',
        }"
      />

      <div
        :style="{
          position: 'absolute',
          inset: '0',
          zIndex: '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          color: 'var(--lg-search-orb-icon, rgba(255,255,255,0.75))',
        }"
      >
        <svg
          :style="{ width: `${iconSize}px`, height: `${iconSize}px` }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </div>
    </button>
  </div>
</template>

<style scoped>
.lg-search-input-field::placeholder {
  color: var(--lg-search-placeholder, rgba(255, 255, 255, 0.78));
  opacity: 1;
  text-shadow: var(
    --lg-search-placeholder-shadow,
    0 1px 2px rgba(0, 0, 0, 0.25)
  );
}

.lg-search-input-field:focus::placeholder {
  color: var(--lg-search-placeholder-focus, rgba(255, 255, 255, 0.9));
}
</style>
