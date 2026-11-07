<script setup lang="ts">
import { computed, ref, useId, type CSSProperties } from "vue";
import {
  useGlassHover,
  type GlassHoverOptions,
} from "../composables/useGlassHover";
import LiquidGlassFilter from "./LiquidGlassFilter.vue";

const props = withDefaults(
  defineProps<{
    label?: string;
    size?:
      | "xSmall"
      | "small"
      | "medium"
      | "large"
      | "navBar"
      | "xLarge";
    variant?: "default" | "primary";
    disabled?: boolean;
    width?: number;
    // Liquid glass tuning
    specularOpacity?: number;
    specularSaturation?: number;
    refractionLevel?: number;
    blur?: number;
    bezelWidth?: number;
    glassThickness?: number;
    refractiveIndexBase?: number;
    hoverRefractiveBoost?: number;
    pressedRefractionBoost?: number;
    // Motion / layout
    pressScale?: number;
    fontWeight?: number | string;
    letterSpacing?: string;
    transition?: string;
    // Theme-able visual props (fallbacks keep current look)
    borderColor?: string;
    textColor?: string;
    backgroundColor?: string;
    backgroundColorPressed?: string;
    shadow?: string;
    shadowPressed?: string;
    borderStyle?: string;
    hoverLight?: boolean;
    hoverLightOptions?: GlassHoverOptions;
    scrollFast?: boolean;
    ariaLabel?: string;
  }>(),
  {
    label: "Liquid Glass Button",
    size: "medium",
    variant: "default",
    disabled: false,
    width: 180,
    specularOpacity: 0.4,
    specularSaturation: 8,
    refractionLevel: 0.4,
    blur: 1,
    bezelWidth: 12,
    glassThickness: 80,
    refractiveIndexBase: 1.4,
    hoverRefractiveBoost: 0.12,
    pressedRefractionBoost: 0.05,
    pressScale: 0.97,
    fontWeight: 600,
    letterSpacing: "0.01em",
    transition:
      "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease, background-color 200ms ease",
    borderColor: "var(--lg-button-border, rgba(255, 255, 255, 0.15))",
    textColor: "var(--lg-button-text, rgba(255, 255, 255, 0.95))",
    backgroundColor: "var(--lg-button-bg, rgba(255,255,255,0.05))",
    backgroundColorPressed:
      "var(--lg-button-bg-pressed, rgba(255,255,255,0.05))",
    shadow: "var(--lg-button-shadow, 0 2px 10px rgba(0,0,0,0.05))",
    shadowPressed:
      "var(--lg-button-shadow-pressed, 0 4px 24px rgba(0,0,0,0.1))",
    borderStyle: "1px solid",
    hoverLight: true,
    scrollFast: true,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const sizePresets = {
  xSmall: { height: 32, fontSize: 13 },
  small: { height: 36, fontSize: 14 },
  medium: { height: 40, fontSize: 15 },
  large: { height: 44, fontSize: 16 },
  /** Matches a 3.625rem nav bar at 16px root (58px) */
  navBar: { height: 58, fontSize: 14 },
  xLarge: { height: 62, fontSize: 18 },
};

const pressed = ref(false);
const buttonRef = ref<HTMLButtonElement | null>(null);
const filterId = `lg-button-${useId()}`;
const { hoverStyle, hoverProgress } = useGlassHover(
  buttonRef,
  props.hoverLightOptions,
);

const dimensions = computed(() => sizePresets[props.size]);
const height = computed(() => dimensions.value.height);
const radius = computed(() => height.value / 2);
const hoverRefractiveIndex = computed(
  () =>
    props.refractiveIndexBase +
    hoverProgress.value * props.hoverRefractiveBoost,
);
const scaleRatio = computed(() =>
  pressed.value
    ? props.refractionLevel + props.pressedRefractionBoost
    : props.refractionLevel,
);
const isPrimary = computed(() => props.variant === "primary");
const resolvedBlur = computed(() =>
  isPrimary.value ? props.blur + 2.2 : props.blur,
);
const resolvedScaleRatio = computed(() =>
  isPrimary.value ? scaleRatio.value * 0.58 : scaleRatio.value,
);
const resolvedSpecularOpacity = computed(() =>
  isPrimary.value
    ? Math.min(props.specularOpacity, 0.26)
    : props.specularOpacity,
);
const resolvedSpecularSaturation = computed(() =>
  isPrimary.value ? props.specularSaturation + 12 : props.specularSaturation,
);
const resolvedBorderColor = computed(() =>
  isPrimary.value
    ? "var(--lg-button-primary-border, rgba(3, 119, 247, 0.75))"
    : props.borderColor,
);
const resolvedTextColor = computed(() =>
  isPrimary.value
    ? "var(--lg-button-primary-text, rgba(255, 255, 255, 0.98))"
    : props.textColor,
);
const resolvedBackgroundColor = computed(() =>
  isPrimary.value
    ? "var(--lg-button-primary-bg, rgba(3, 119, 247, 0.95))"
    : props.backgroundColor,
);
const resolvedBackgroundColorPressed = computed(() =>
  isPrimary.value
    ? "var(--lg-button-primary-bg-pressed, rgba(3, 119, 247, 0.97))"
    : props.backgroundColorPressed,
);
const resolvedShadow = computed(() =>
  isPrimary.value
    ? "var(--lg-button-primary-shadow, 0 2px 12px rgba(3, 119, 247, 0.3))"
    : props.shadow,
);
const resolvedShadowPressed = computed(() =>
  isPrimary.value
    ? "var(--lg-button-primary-shadow-pressed, 0 6px 24px rgba(3, 119, 247, 0.38))"
    : props.shadowPressed,
);
const buttonStyle = computed<CSSProperties>(() => ({
  position: "relative",
  width: `${props.width}px`,
  height: `${height.value}px`,
  borderRadius: `${radius.value}px`,
  border: `${props.borderStyle} ${resolvedBorderColor.value}`,
  color: resolvedTextColor.value,
  fontSize: `${dimensions.value.fontSize}px`,
  fontWeight: props.fontWeight,
  letterSpacing: props.letterSpacing,
  cursor: props.disabled ? "not-allowed" : "pointer",
  userSelect: "none",
  transition: props.transition,
  transform: pressed.value ? `scale(${props.pressScale})` : "scale(1)",
  overflow: "hidden",
  backdropFilter: `url(#${filterId})`,
  WebkitBackdropFilter: `url(#${filterId})`,
  backgroundColor: pressed.value
    ? resolvedBackgroundColorPressed.value
    : resolvedBackgroundColor.value,
  boxShadow: pressed.value ? resolvedShadowPressed.value : resolvedShadow.value,
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
  opacity: resolvedSpecularOpacity.value,
}));

const handlePointerDown = () => {
  if (props.disabled) return;
  pressed.value = true;
};

const handlePointerUp = () => {
  pressed.value = false;
};

const handleClick = (event: MouseEvent) => {
  if (props.disabled) return;
  emit("click", event);
};
</script>

<template>
  <div
    :style="{
      position: 'relative',
      display: 'inline-block',
      opacity: disabled ? 0.5 : 1,
    }"
  >
    <LiquidGlassFilter
      :id="filterId"
      :width="width"
      :height="height"
      :radius="radius"
      :bezel-width="bezelWidth"
      :glass-thickness="glassThickness"
      :refractive-index="hoverRefractiveIndex"
      bezel-type="convex_squircle"
      shape="pill"
      :blur="resolvedBlur"
      :scale-ratio="resolvedScaleRatio"
      :specular-opacity="resolvedSpecularOpacity"
      :specular-saturation="resolvedSpecularSaturation"
      :scroll-fast="scrollFast"
      :inline-specular="false"
      @specular="specularUrl = $event"
    />

    <button
      ref="buttonRef"
      type="button"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :style="buttonStyle"
      @pointerdown="handlePointerDown"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @pointerleave="handlePointerUp"
      @click="handleClick"
    >
      <div v-if="specularUrl && resolvedSpecularOpacity > 0" :style="specularStyle" />
      <div
        v-if="hoverLight"
        :style="{
          ...hoverStyle,
          borderRadius: `${radius}px`,
          overflow: 'hidden',
        }"
      />
      <span :style="{ position: 'relative', zIndex: 1 }">
        <slot>{{ label }}</slot>
      </span>
    </button>
  </div>
</template>
