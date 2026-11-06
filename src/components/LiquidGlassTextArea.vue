<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, useId, type CSSProperties } from "vue";
import { useGlassHover, type GlassHoverOptions } from "../composables/useGlassHover";
import LiquidGlassFilter from "./LiquidGlassFilter.vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    size?: "small" | "medium" | "large";
    disabled?: boolean;
    minRows?: number;
    maxRows?: number;
    radius?: number;
    cornerRadius?: number;
    inputFilterBlur?: number;
    inputFilterScaleRatio?: number;
    inputSpecularOpacity?: number;
    inputSpecularSaturation?: number;
    inputRefractiveIndex?: number;
    hoverLight?: boolean;
    hoverLightOptions?: GlassHoverOptions;
  }>(),
  {
    modelValue: "",
    placeholder: "Write something...",
    size: "medium",
    disabled: false,
    minRows: 4,
    maxRows: 12,
    radius: 26,
    cornerRadius: 0.6,
    inputFilterBlur: 2,
    inputFilterScaleRatio: 0.4,
    inputSpecularOpacity: 0.26,
    inputSpecularSaturation: 4,
    inputRefractiveIndex: 1.45,
    hoverLight: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  focus: [];
  blur: [];
}>();

const sizePresets = {
  small: {
    fontSize: 13,
    lineHeight: 1.45,
    paddingX: 16,
    paddingY: 12,
    bezelWidth: 8,
    glassThickness: 60,
  },
  medium: {
    fontSize: 15,
    lineHeight: 1.5,
    paddingX: 18,
    paddingY: 14,
    bezelWidth: 8,
    glassThickness: 80,
  },
  large: {
    fontSize: 17,
    lineHeight: 1.55,
    paddingX: 20,
    paddingY: 16,
    bezelWidth: 12,
    glassThickness: 100,
  },
};

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const focused = ref(false);
const measuredWidth = ref(0);
const measuredHeight = ref(0);
const { hoverStyle, isHovering } = useGlassHover(containerRef, props.hoverLightOptions);

const query = computed({
  get: () => props.modelValue,
  set: (val: string) => emit("update:modelValue", val),
});

const dimensions = computed(() => sizePresets[props.size]);
const lineHeightPx = computed(() =>
  Math.round(dimensions.value.fontSize * dimensions.value.lineHeight),
);
const minHeight = computed(
  () => lineHeightPx.value * props.minRows + dimensions.value.paddingY * 2,
);
const maxHeight = computed(
  () => lineHeightPx.value * props.maxRows + dimensions.value.paddingY * 2,
);
const borderRadius = computed(() =>
  Math.min(props.radius, Math.min(measuredWidth.value || props.radius * 2, measuredHeight.value || props.radius * 2) / 2),
);

const filterId = `lg-textarea-input-${useId()}`;
const glassReady = computed(() => measuredWidth.value > 0 && measuredHeight.value > 0);

const rootStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "100%",
}));

const containerStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: "100%",
  minHeight: `${minHeight.value}px`,
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
  padding: `${dimensions.value.paddingY}px ${dimensions.value.paddingX}px`,
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

const textareaStyle = computed<CSSProperties>(() => ({
  width: "100%",
  minHeight: `${minHeight.value - dimensions.value.paddingY * 2}px`,
  maxHeight: `${maxHeight.value - dimensions.value.paddingY * 2}px`,
  resize: "none",
  overflowY: "auto",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--lg-search-text, rgba(255,255,255,0.92))",
  fontWeight: "500",
  fontSize: `${dimensions.value.fontSize}px`,
  lineHeight: `${dimensions.value.lineHeight}`,
}));

let resizeObserver: ResizeObserver | null = null;

const autoResize = () => {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  const desiredHeight = Math.min(Math.max(el.scrollHeight, minHeight.value - dimensions.value.paddingY * 2), maxHeight.value - dimensions.value.paddingY * 2);
  el.style.height = `${desiredHeight}px`;
};

const syncMeasuredSize = () => {
  const el = containerRef.value;
  if (!el) return;
  measuredWidth.value = el.offsetWidth;
  measuredHeight.value = el.offsetHeight;
};

watch(
  () => props.modelValue,
  async () => {
    await nextTick();
    autoResize();
    syncMeasuredSize();
  },
);

onMounted(async () => {
  await nextTick();
  autoResize();
  syncMeasuredSize();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      syncMeasuredSize();
    });
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
      />

      <div :style="glassStyle" />

      <div v-if="hoverLight" :style="hoverOverlayStyle" />
      <div v-if="hoverLight && focused && !isHovering" :style="focusOverlayStyle" />

      <div :style="contentStyle">
        <textarea
          ref="textareaRef"
          v-model="query"
          class="lg-textarea-field"
          :placeholder="placeholder"
          :disabled="disabled"
          :style="textareaStyle"
          @input="autoResize"
          @focus="handleFocus"
          @blur="handleBlur"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lg-textarea-field::placeholder {
  color: var(--lg-search-placeholder, rgba(255, 255, 255, 0.78));
  opacity: 1;
  text-shadow: var(
    --lg-search-placeholder-shadow,
    0 1px 2px rgba(0, 0, 0, 0.25)
  );
}

.lg-textarea-field:focus::placeholder {
  color: var(--lg-search-placeholder-focus, rgba(255, 255, 255, 0.9));
}
</style>
