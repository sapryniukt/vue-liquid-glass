<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, useId } from "vue";
import {
  useGlassHover,
  type GlassHoverOptions,
} from "../composables/useGlassHover";
import LiquidGlassFilter from "./LiquidGlassFilter.vue";

interface NavItem {
  id: string;
  label: string;
  icon?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    items: NavItem[];
    size?: "xs" | "small" | "medium" | "large";
    disabled?: boolean;
    activeColor?: string;
    hoverLight?: boolean;
    hoverLightOptions?: GlassHoverOptions;
    scrollFast?: boolean;
    itemGap?: number;
    thumbHeightOffset?: number;
    minThumbWidth?: number;
    sideInsetAdjust?: number;
    thumbRestScale?: number;
    thumbActiveScale?: number;
    pressLerp?: number;
    releaseDelayMs?: number;
    dragOverflowDamping?: number;
    morphLerp?: number;
    morphMaxStretch?: number;
    morphSkewFactor?: number;
    morphMaxSkewDeg?: number;
    labelInactiveOpacity?: number;
    labelActiveScale?: number;
    activeSuffix?: string;
    trackFilterBezelWidth?: number;
    trackFilterGlassThickness?: number;
    trackFilterRefractiveIndex?: number;
    trackFilterBlur?: number;
    trackFilterScaleRatio?: number;
    trackFilterSpecularOpacity?: number;
    trackFilterSpecularSaturation?: number;
    thumbFilterRefractiveIndex?: number;
    thumbFilterBlur?: number;
    thumbFilterScaleRatio?: number;
    thumbFilterSpecularOpacity?: number;
    thumbFilterSpecularSaturation?: number;
  }>(),
  {
    modelValue: "",
    size: "medium",
    disabled: false,
    activeColor: "var(--lg-nav-active, rgb(3, 119, 247))",
    hoverLight: true,
    scrollFast: false,
    itemGap: 4,
    thumbHeightOffset: 2,
    minThumbWidth: 44,
    sideInsetAdjust: 0,
    thumbRestScale: 1,
    thumbActiveScale: 1.38,
    pressLerp: 0.26,
    releaseDelayMs: 420,
    dragOverflowDamping: 3,
    morphLerp: 0.34,
    morphMaxStretch: 22,
    morphSkewFactor: 0.55,
    morphMaxSkewDeg: 8,
    labelInactiveOpacity: 0.72,
    labelActiveScale: 1.05,
    activeSuffix: "",
    trackFilterBezelWidth: 12,
    trackFilterGlassThickness: 90,
    trackFilterRefractiveIndex: 1.35,
    trackFilterBlur: 1,
    trackFilterScaleRatio: 0.4,
    trackFilterSpecularOpacity: 0.35,
    trackFilterSpecularSaturation: 8,
    thumbFilterRefractiveIndex: 1.3,
    thumbFilterBlur: 0.3,
    thumbFilterScaleRatio: 0.3,
    thumbFilterSpecularOpacity: 0.58,
    thumbFilterSpecularSaturation: 9,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const sizePresets = {
  xs: {
    height: 28,
    itemWidth: 46,
    thumbHeight: 24,
    iconSize: 12,
    fontSize: 11,
    bezelWidth: 4,
    glassThickness: 28,
  },
  small: {
    height: 44,
    itemWidth: 72,
    thumbHeight: 40,
    iconSize: 16,
    fontSize: 11,
    bezelWidth: 10,
    glassThickness: 70,
  },
  medium: {
    height: 54,
    itemWidth: 88,
    thumbHeight: 50,
    iconSize: 18,
    fontSize: 12,
    bezelWidth: 12,
    glassThickness: 80,
  },
  large: {
    height: 64,
    itemWidth: 104,
    thumbHeight: 58,
    iconSize: 20,
    fontSize: 13,
    bezelWidth: 14,
    glassThickness: 90,
  },
} as const;

const dims = computed(() => sizePresets[props.size]);
const safeItems = computed(() => props.items ?? []);
const trackRef = ref<HTMLElement | null>(null);
const { hoverStyle: navHoverStyle } = useGlassHover(
  trackRef,
  props.hoverLightOptions,
);
const navWidth = computed(
  () => Math.max(1, safeItems.value.length) * dims.value.itemWidth,
);
const navHeight = computed(() => dims.value.height);
const thumbHeight = computed(() =>
  Math.max(24, dims.value.thumbHeight - props.thumbHeightOffset),
);
const thumbTopInset = computed(() => (navHeight.value - thumbHeight.value) / 2);
const thumbSideInset = computed(() =>
  Math.max(0, thumbTopInset.value + props.sideInsetAdjust),
);
const thumbWidth = computed(() =>
  Math.max(
    props.minThumbWidth,
    dims.value.itemWidth - thumbSideInset.value * 2,
  ),
);
const thumbRadius = computed(() => thumbHeight.value / 2);
const selectedIndex = computed(() => {
  const idx = safeItems.value.findIndex((item) => item.id === props.modelValue);
  return idx >= 0 ? idx : 0;
});
const suffixEl = ref<HTMLElement | null>(null);
let suffixFrom: DOMRect | null = null;

function setSuffixEl(el: unknown) {
  if (el instanceof HTMLElement) {
    suffixEl.value = el;
    return;
  }
  if (suffixEl.value && !suffixEl.value.isConnected) suffixEl.value = null;
}

watch(
  selectedIndex,
  () => {
    suffixFrom = suffixEl.value?.getBoundingClientRect() ?? suffixFrom;
  },
  { flush: "pre" },
);

watch(selectedIndex, async () => {
  if (!props.activeSuffix) return;
  await nextTick();
  const node = suffixEl.value;
  if (!node) return;
  const to = node.getBoundingClientRect();
  const from = suffixFrom;
  suffixFrom = to;
  if (!from) return;
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  node.style.transition = "none";
  node.style.transform = `translate(${dx}px, ${dy}px)`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!node.isConnected) return;
      node.style.transition = "transform 460ms cubic-bezier(0.22, 1, 0.36, 1)";
      node.style.transform = "translate(0, 0)";
    });
  });
});

const targetThumbX = (index: number) => {
  const offset = thumbSideInset.value;
  return index * dims.value.itemWidth + offset;
};

const pointerDown = ref(0);
const initialPointerX = ref(0);
const initialThumbX = ref(0);
const currentThumbX = ref(0);
const pressProgress = ref(0);
const morphScaleX = ref(1);
const morphScaleY = ref(1);
const morphSkewDeg = ref(0);
let pressAnimationFrame: number | null = null;
let morphAnimationFrame: number | null = null;
let glideFrame: number | null = null;
let glassReleaseTimeout: ReturnType<typeof setTimeout> | null = null;
const gliding = ref(false);
const coloredId = ref(props.modelValue);

const THUMB_REST_SCALE = computed(() => props.thumbRestScale);
const THUMB_ACTIVE_SCALE = computed(() => props.thumbActiveScale);

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

const stopMorphAnimation = () => {
  if (morphAnimationFrame !== null) {
    cancelAnimationFrame(morphAnimationFrame);
    morphAnimationFrame = null;
  }
};

const animateMorphToRest = () => {
  stopMorphAnimation();
  const tick = () => {
    morphScaleX.value += (1 - morphScaleX.value) * props.morphLerp;
    morphScaleY.value += (1 - morphScaleY.value) * props.morphLerp;
    morphSkewDeg.value += (0 - morphSkewDeg.value) * (props.morphLerp + 0.02);

    const settled =
      Math.abs(1 - morphScaleX.value) < 0.001 &&
      Math.abs(1 - morphScaleY.value) < 0.001 &&
      Math.abs(morphSkewDeg.value) < 0.01;

    if (settled) {
      morphScaleX.value = 1;
      morphScaleY.value = 1;
      morphSkewDeg.value = 0;
      morphAnimationFrame = null;
      return;
    }
    morphAnimationFrame = requestAnimationFrame(tick);
  };
  morphAnimationFrame = requestAnimationFrame(tick);
};

const animatePressProgressTo = (target: number, onDone?: () => void) => {
  stopPressAnimation();
  const tick = () => {
    const current = pressProgress.value;
    const next = current + (target - current) * props.pressLerp;
    pressProgress.value = next;
    if (Math.abs(target - next) < 0.001) {
      pressProgress.value = target;
      pressAnimationFrame = null;
      onDone?.();
      return;
    }
    pressAnimationFrame = requestAnimationFrame(tick);
  };
  pressAnimationFrame = requestAnimationFrame(tick);
};

const releaseGlass = (index: number) => {
  clearGlassReleaseTimeout();
  glassReleaseTimeout = setTimeout(() => {
    if (pointerDown.value !== 0) return;
    animatePressProgressTo(0, () => settleColor(index));
  }, props.releaseDelayMs);
};

const stopGlide = () => {
  if (glideFrame !== null) {
    cancelAnimationFrame(glideFrame);
    glideFrame = null;
  }
  gliding.value = false;
};

const settleColor = (index: number) => {
  coloredId.value = safeItems.value[index]?.id ?? coloredId.value;
};

const glideThumbTo = (index: number) => {
  stopGlide();
  stopMorphAnimation();
  const destination = targetThumbX(index);
  if (Math.abs(destination - currentThumbX.value) < 0.5) {
    currentThumbX.value = destination;
    settleColor(index);
    return;
  }

  gliding.value = true;
  coloredId.value = "";
  clearGlassReleaseTimeout();
  animatePressProgressTo(1);

  const tick = () => {
    if (pointerDown.value !== 0) {
      stopGlide();
      return;
    }
    const delta = destination - currentThumbX.value;
    if (Math.abs(delta) < 0.35) {
      currentThumbX.value = destination;
      stopGlide();
      animateMorphToRest();
      releaseGlass(index);
      return;
    }
    const velocity = delta * 0.28;
    const speed = Math.min(Math.abs(velocity), props.morphMaxStretch);
    const stretch = 1 + speed * 0.02;
    const squash = Math.max(0.84, 1 - (stretch - 1) * 0.65);
    const tilt = Math.max(
      -props.morphMaxSkewDeg,
      Math.min(props.morphMaxSkewDeg, velocity * props.morphSkewFactor),
    );
    morphScaleX.value += (stretch - morphScaleX.value) * props.morphLerp;
    morphScaleY.value += (squash - morphScaleY.value) * props.morphLerp;
    morphSkewDeg.value += (tilt - morphSkewDeg.value) * props.morphLerp;
    currentThumbX.value += velocity;
    glideFrame = requestAnimationFrame(tick);
  };
  glideFrame = requestAnimationFrame(tick);
};

const isActive = computed(
  () => pointerDown.value > 0.5 || pressProgress.value > 0.02,
);
const thumbScale = computed(
  () =>
    THUMB_REST_SCALE.value +
    (THUMB_ACTIVE_SCALE.value - THUMB_REST_SCALE.value) * pressProgress.value,
);
const thumbBackgroundOpacity = computed(() => 1 - 0.9 * pressProgress.value);

const trackFilterId = `lg-nav-track-${useId()}`;
const thumbFilterId = `lg-nav-thumb-${useId()}`;

const setActive = (id: string) => {
  if (props.disabled || id === props.modelValue) return;
  emit("update:modelValue", id);
  animatePressProgressTo(1);
};

const handleThumbPointerDown = (e: MouseEvent | TouchEvent) => {
  if (props.disabled) return;
  clearGlassReleaseTimeout();
  stopMorphAnimation();
  pointerDown.value = 1;
  animatePressProgressTo(1);
  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  initialPointerX.value = clientX;
  initialThumbX.value = currentThumbX.value;
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("touchmove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);
  window.addEventListener("touchend", handlePointerUp);
};

const getDraggedThumbPos = (clientX: number) => {
  const rect = trackRef.value?.getBoundingClientRect();
  if (!rect) return currentThumbX.value;
  const relX = clientX - rect.left;
  let newPos = relX - thumbWidth.value / 2;

  const minX = targetThumbX(0);
  const maxX = targetThumbX(Math.max(0, safeItems.value.length - 1));
  if (newPos < minX) {
    const overflow = minX - newPos;
    newPos = minX - overflow / props.dragOverflowDamping;
  } else if (newPos > maxX) {
    const overflow = newPos - maxX;
    newPos = maxX + overflow / props.dragOverflowDamping;
  }
  return newPos;
};

const startTrackDrag = (e: MouseEvent | TouchEvent) => {
  if (props.disabled) return;
  clearGlassReleaseTimeout();
  stopMorphAnimation();
  pointerDown.value = 1;
  animatePressProgressTo(1);
  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  initialPointerX.value = clientX;
  initialThumbX.value = currentThumbX.value;
  const desired = getDraggedThumbPos(clientX);
  currentThumbX.value =
    currentThumbX.value + (desired - currentThumbX.value) * 0.35;
  window.addEventListener("mousemove", handlePointerMove);
  window.addEventListener("touchmove", handlePointerMove);
  window.addEventListener("mouseup", handlePointerUp);
  window.addEventListener("touchend", handlePointerUp);
};

const handlePointerMove = (e: PointerEvent | MouseEvent | TouchEvent) => {
  if (pointerDown.value === 0 || props.disabled) return;
  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  const next = getDraggedThumbPos(clientX);
  const velocity = next - currentThumbX.value;
  const speed = Math.min(Math.abs(velocity), props.morphMaxStretch);
  const stretch = 1 + speed * 0.018;
  const squash = Math.max(0.84, 1 - (stretch - 1) * 0.7);
  const tilt = Math.max(
    -props.morphMaxSkewDeg,
    Math.min(props.morphMaxSkewDeg, velocity * props.morphSkewFactor),
  );

  morphScaleX.value += (stretch - morphScaleX.value) * props.morphLerp;
  morphScaleY.value += (squash - morphScaleY.value) * props.morphLerp;
  morphSkewDeg.value += (tilt - morphSkewDeg.value) * props.morphLerp;
  currentThumbX.value = next;
};

const handlePointerUp = () => {
  if (pointerDown.value === 0) return;
  pointerDown.value = 0;
  window.removeEventListener("mousemove", handlePointerMove);
  window.removeEventListener("touchmove", handlePointerMove);
  window.removeEventListener("mouseup", handlePointerUp);
  window.removeEventListener("touchend", handlePointerUp);

  const centerX = currentThumbX.value + thumbWidth.value / 2;
  let index = Math.round(
    (centerX - dims.value.itemWidth / 2) / dims.value.itemWidth,
  );
  index = Math.max(0, Math.min(index, safeItems.value.length - 1));
  const item = safeItems.value[index];
  if (item && item.id !== props.modelValue) emit("update:modelValue", item.id);
  stopGlide();
  currentThumbX.value = targetThumbX(index);
  animateMorphToRest();

  releaseGlass(index);
};

watch(
  selectedIndex,
  (index, previous) => {
    if (pointerDown.value !== 0) return;
    if (previous === undefined) {
      currentThumbX.value = targetThumbX(index);
      settleColor(index);
      return;
    }
    glideThumbTo(index);
  },
  { immediate: true },
);

onUnmounted(() => {
  stopPressAnimation();
  stopMorphAnimation();
  stopGlide();
  clearGlassReleaseTimeout();
  window.removeEventListener("mousemove", handlePointerMove);
  window.removeEventListener("touchmove", handlePointerMove);
  window.removeEventListener("mouseup", handlePointerUp);
  window.removeEventListener("touchend", handlePointerUp);
});
</script>

<template>
  <div
    :style="{
      display: 'inline-block',
      userSelect: 'none',
      touchAction: 'none',
      opacity: disabled ? 0.5 : 1,
    }"
  >
    <div
      ref="trackRef"
      :style="{
        position: 'relative',
        width: `${navWidth}px`,
        height: `${navHeight}px`,
        borderRadius: `${navHeight / 2}px`,
        overflow: 'visible',
      }"
    >
      <LiquidGlassFilter
        :id="trackFilterId"
        :width="navWidth"
        :height="navHeight"
        :radius="navHeight / 2"
        :curvature-boost="1.0"
        :bezel-width="trackFilterBezelWidth"
        :glass-thickness="trackFilterGlassThickness"
        :refractive-index="trackFilterRefractiveIndex"
        bezel-type="convex_squircle"
        shape="pill"
        :blur="trackFilterBlur"
        :scale-ratio="trackFilterScaleRatio"
        :specular-opacity="trackFilterSpecularOpacity"
        :specular-saturation="trackFilterSpecularSaturation"
        :scroll-fast="scrollFast"
      />

      <div
        :style="{
          position: 'absolute',
          inset: '0',
          borderRadius: `${navHeight / 2}px`,
          backdropFilter: `url(#${trackFilterId})`,
          WebkitBackdropFilter: `url(#${trackFilterId})`,
          backgroundColor: 'var(--lg-nav-track-bg, rgba(255,255,255,0.06))',
          border:
            '1px solid var(--lg-nav-track-border, rgba(255,255,255,0.18))',
          boxShadow:
            'var(--lg-nav-track-shadow, inset 0 0 12px rgba(255,255,255,0.08), 0 4px 18px rgba(0,0,0,0.12))',
        }"
      />

      <div
        v-if="hoverLight"
        :style="{
          ...navHoverStyle,
          borderRadius: `${navHeight / 2}px`,
          overflow: 'hidden',
          zIndex: 25,
        }"
      />

      <LiquidGlassFilter
        :id="thumbFilterId"
        :width="thumbWidth"
        :height="thumbHeight"
        :radius="thumbRadius"
        :curvature-boost="1.06"
        :bezel-width="dims.bezelWidth"
        :glass-thickness="dims.glassThickness"
        :refractive-index="thumbFilterRefractiveIndex"
        bezel-type="lip"
        shape="pill"
        :blur="thumbFilterBlur"
        :scale-ratio="thumbFilterScaleRatio"
        :specular-opacity="thumbFilterSpecularOpacity"
        :specular-saturation="thumbFilterSpecularSaturation"
        :scroll-fast="scrollFast"
      />

      <div
        :style="{
          position: 'absolute',
          top: `${thumbTopInset}px`,
          left: '0',
          width: `${thumbWidth}px`,
          height: `${thumbHeight}px`,
          transform: `translateX(${currentThumbX}px) scale(${thumbScale}) scaleX(${morphScaleX}) scaleY(${morphScaleY}) skewX(${morphSkewDeg}deg)`,
          borderRadius: `${thumbRadius}px`,
          transition:
            pointerDown > 0.5 || gliding
              ? 'transform 60ms linear, background-color 180ms ease, box-shadow 180ms ease'
              : 'transform 460ms cubic-bezier(0.22,1,0.36,1), background-color 240ms ease, box-shadow 240ms ease',
          backdropFilter: `url(#${thumbFilterId})`,
          WebkitBackdropFilter: `url(#${thumbFilterId})`,
          backgroundColor: isActive
            ? `rgba(var(--lg-nav-thumb-rgb, 255,255,255), ${thumbBackgroundOpacity})`
            : 'var(--lg-nav-thumb-bg, rgba(255,255,255,0.95))',
          border: isActive
            ? '1px solid var(--lg-nav-thumb-border-active, rgba(255,255,255,0.22))'
            : '1px solid var(--lg-nav-thumb-border, rgba(255,255,255,0.38))',
          boxShadow: isActive
            ? 'var(--lg-nav-thumb-shadow-active, 0 6px 22px rgba(0,0,0,0.16), inset 2px 6px 20px rgba(0,0,0,0.08), inset -2px -6px 20px rgba(255,255,255,0.08))'
            : 'var(--lg-nav-thumb-shadow, 0 6px 22px rgba(0,0,0,0.2), inset 0 1px 12px rgba(255,255,255,0.28))',
          zIndex: 40,
          pointerEvents: 'auto',
        }"
        @mousedown="handleThumbPointerDown"
        @touchstart.stop.prevent="handleThumbPointerDown"
      />

      <div
        :style="{
          position: 'absolute',
          inset: '0',
          display: 'flex',
          zIndex: 30,
        }"
      >
        <button
          v-for="item in safeItems"
          :key="item.id"
          type="button"
          :disabled="disabled"
          :style="{
            width: `${dims.itemWidth}px`,
            height: '100%',
            border: 'none',
            background: 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }"
          @mousedown.prevent="startTrackDrag"
          @touchstart.prevent="startTrackDrag"
          @click="setActive(item.id)"
        />
      </div>

      <div
        :style="{
          position: 'absolute',
          inset: '0',
          display: 'flex',
          zIndex: isActive ? 20 : 50,
          pointerEvents: 'none',
        }"
      >
        <div
          v-for="item in safeItems"
          :key="`label-${item.id}`"
          :style="{
            width: `${dims.itemWidth}px`,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: `${itemGap}px`,
            opacity: item.id === modelValue ? 1 : labelInactiveOpacity,
            transform:
              item.id === modelValue
                ? `scale(${labelActiveScale})`
                : 'scale(1)',
            transition: 'all 120ms ease',
          }"
        >
          <span
            v-if="item.icon"
            :style="{
              width: `${dims.iconSize}px`,
              height: `${dims.iconSize}px`,
              display: 'block',
              color:
                item.id === coloredId
                  ? activeColor
                  : 'var(--lg-nav-text, rgba(255,255,255,0.82))',
            }"
            v-html="item.icon"
          />
          <span
            :style="{
              fontSize: `${dims.fontSize}px`,
              lineHeight: 1,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color:
                item.id === coloredId
                  ? activeColor
                  : 'var(--lg-nav-text, rgba(255,255,255,0.82))',
            }"
          >
            {{ item.label }}<span
              v-if="activeSuffix && item.id === modelValue"
              :ref="setSuffixEl"
              :style="{
                display: 'inline',
                margin: 0,
                padding: 0,
                letterSpacing: 0,
                font: 'inherit',
                color: 'inherit',
              }"
            >{{ activeSuffix }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
