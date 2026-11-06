<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, type CSSProperties } from "vue";
import { useGlassHover, type GlassHoverOptions } from "../composables/useGlassHover";
import LiquidGlassFilter from "./LiquidGlassFilter.vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    type?: "text" | "email" | "password" | "search" | "url" | "tel";
    size?: "small" | "medium" | "large";
    disabled?: boolean;
    radius?: number;
    cornerRadius?: number;
    inputFilterBlur?: number;
    inputFilterScaleRatio?: number;
    inputSpecularOpacity?: number;
    inputSpecularSaturation?: number;
    inputRefractiveIndex?: number;
    hoverLight?: boolean;
    hoverLightOptions?: GlassHoverOptions;
    scrollFast?: boolean;
  }>(),
  {
    modelValue: "",
    placeholder: "Type here...",
    type: "text",
    size: "medium",
    disabled: false,
    radius: 26,
    cornerRadius: 0.6,
    inputFilterBlur: 2,
    inputFilterScaleRatio: 0.4,
    inputSpecularOpacity: 0.26,
    inputSpecularSaturation: 4,
    inputRefractiveIndex: 1.45,
    hoverLight: true,
    scrollFast: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  focus: [];
  blur: [];
}>();

const sizePresets = {
  small: { height: 40, fontSize: 13, paddingX: 16, bezelWidth: 8, glassThickness: 60 },
  medium: { height: 52, fontSize: 15, paddingX: 18, bezelWidth: 8, glassThickness: 80 },
  large: { height: 64, fontSize: 17, paddingX: 20, bezelWidth: 12, glassThickness: 100 },
};

const inputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const focused = ref(false);
const measuredWidth = ref(0);
const measuredHeight = ref(0);
const { hoverStyle, isHovering } = useGlassHover(containerRef, props.hoverLightOptions);

const value = computed({
  get: () => props.modelValue,
  set: (val: string) => emit("update:modelValue", val),
});

const dimensions = computed(() => sizePresets[props.size]);
const borderRadius = computed(() =>
  Math.min(
    props.radius,
    Math.min(
      measuredWidth.value || props.radius * 2,
      measuredHeight.value || props.radius * 2,
    ) / 2,
  ),
);
const glassReady = computed(() => measuredWidth.value > 0 && measuredHeight.value > 0);
const filterId = `lg-input-${useId()}`;

const rootStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "100%",
}));

const containerStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "100%",
  height: `${dimensions.value.height}px`,
  borderRadius: `${borderRadius.value}px`,
  overflow: "hidden",
  isolation: "isolate",
}));

const glassStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  zIndex: "0",
  borderRadius: `${borderRadius.value}px`,
  backdropFilter: glassReady.value ? `url(#${filterId})` : "none",
  WebkitBackdropFilter: glassReady.value ? `url(#${filterId})` : "none",
  backgroundColor: "var(--lg-search-input-bg, rgba(255,255,255,0.05))",
  boxShadow: focused.value
    ? "var(--lg-search-input-shadow-expanded, 0 4px 24px rgba(0,0,0,0.1))"
    : "var(--lg-search-input-shadow, 0 2px 10px rgba(0,0,0,0.05))",
}));

const contentStyle = computed<CSSProperties>(() => ({
  position: "relative",
  zIndex: "10",
  height: "100%",
  padding: `0 ${dimensions.value.paddingX}px`,
  display: "flex",
  alignItems: "center",
}));

const inputStyle = computed<CSSProperties>(() => ({
  width: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--lg-search-text, rgba(255,255,255,0.92))",
  fontWeight: "500",
  fontSize: `${dimensions.value.fontSize}px`,
}));
const hoverOverlayStyle = computed<CSSProperties>(() => ({
  ...hoverStyle.value,
  borderRadius: `${borderRadius.value}px`,
  zIndex: "5",
  overflow: "hidden",
  pointerEvents: "none",
}));
const focusOverlayStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  inset: "0",
  zIndex: "4",
  borderRadius: `${borderRadius.value}px`,
  overflow: "hidden",
  pointerEvents: "none",
  background: "linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.06))",
}));

let resizeObserver: ResizeObserver | null = null;

const syncMeasuredSize = () => {
  const el = containerRef.value;
  if (!el) return;
  measuredWidth.value = el.offsetWidth;
  measuredHeight.value = el.offsetHeight;
};

onMounted(async () => {
  await nextTick();
  syncMeasuredSize();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(syncMeasuredSize);
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

const handleFocus = () => {
  focused.value = true;
  emit("focus");
};

const handleBlur = () => {
  focused.value = false;
  emit("blur");
};

defineExpose({ focus: () => inputRef.value?.focus(), blur: () => inputRef.value?.blur() });
</script>

<template>
  <div :style="rootStyle">
    <div ref="containerRef" :style="containerStyle">
      <LiquidGlassFilter
        v-if="glassReady"
        :id="filterId"
        :width="measuredWidth"
        :height="measuredHeight"
        :radius="borderRadius"
        :bezel-width="dimensions.bezelWidth"
        :glass-thickness="dimensions.glassThickness"
        :refractive-index="inputRefractiveIndex"
        bezel-type="convex_squircle"
        shape="rectangle"
        :corner-radius="props.cornerRadius"
        :blur="inputFilterBlur"
        :scale-ratio="inputFilterScaleRatio"
        :specular-opacity="inputSpecularOpacity"
        :specular-saturation="inputSpecularSaturation"
        :scroll-fast="scrollFast"
      />

      <div :style="glassStyle" />

      <div v-if="hoverLight" :style="hoverOverlayStyle" />
      <div v-if="hoverLight && focused && !isHovering" :style="focusOverlayStyle" />

      <div :style="contentStyle">
        <input
          ref="inputRef"
          v-model="value"
          class="lg-input-field"
          :type="type"
          :placeholder="placeholder"
          :disabled="disabled"
          :style="inputStyle"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lg-input-field::placeholder {
  color: var(--lg-search-placeholder, rgba(255, 255, 255, 0.78));
  opacity: 1;
  text-shadow: var(
    --lg-search-placeholder-shadow,
    0 1px 2px rgba(0, 0, 0, 0.25)
  );
}

.lg-input-field:focus::placeholder {
  color: var(--lg-search-placeholder-focus, rgba(255, 255, 255, 0.9));
}
</style>
