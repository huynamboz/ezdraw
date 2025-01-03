<script setup lang="ts">
import { type FabricObject, type FabricObjectProps, type ObjectEvents, type SerializedObjectProps, Point, type TPointerEventInfo, type TPointerEvent } from 'fabric';
import { ref, computed, onMounted } from 'vue';
import { useKeyModifier, useMagicKeys } from '@vueuse/core';

useHead({
  htmlAttrs: { lang: 'en' },
  title: 'Ezdraw - A virtual whiteboard for everyone',
  meta: [{ name: 'description', content: '' }],
});

useSeoMeta({
  charset: 'utf-8',
  author: 'huynamboz',
  title: 'Ezdraw - A virtual whiteboard for everyone',
  ogTitle: 'Ezdraw - A virtual whiteboard for everyone',
  description: 'Ezdraw is a simple drawing tool that allows you to draw with ease',
  ogDescription: 'Ezdraw is a simple drawing tool that allows you to draw with ease',
  ogImage: '/public/images/thumbnail.png',
});

const { space } = useMagicKeys();
const shiftState = useKeyModifier('Shift');
const fabricStore = useFabricStore();
const canvasElement = ref<HTMLCanvasElement | null>(null);
watch(space, (v) => {
  console.log('space has been pressed', v);
  if (v) {
    fabricStore.enableTempMoveMode();
  }
  else {
    fabricStore.restoreActiveTool();
  }
});
const canvas = computed(() => fabricStore.canvas);
const dragTools = ['move', 'select'];
const isMouseDown = ref(false);
const isDragging = ref(false); // Track dragging state
const lastPosX = ref<number>(0);
const lastPosY = ref<number>(0); // Store last mouse positions
const startX = ref<number>(0);
const startY = ref<number>(0);
const fabricObj = ref<FabricObject<Partial<FabricObjectProps>, SerializedObjectProps, ObjectEvents> | null>();

function handleZoomCanvas(opt: TPointerEventInfo<WheelEvent>) {
  if (!canvas.value) {
    return;
  }

  const delta = opt.e.deltaY;
  let zoom = canvas.value.getZoom();
  zoom *= 0.999 ** delta;
  if (zoom > 20) zoom = 20;
  if (zoom < 0.01) zoom = 0.01;
  canvas.value.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom);
  opt.e.preventDefault();
  opt.e.stopPropagation();
}

function handleMouseDown(opt: TPointerEventInfo<MouseEvent>) {
  if (!canvas.value) {
    return;
  }

  const evt = opt.e;
  isMouseDown.value = true;
  if (fabricStore.activeTool === 'move') {
    lastPosX.value = 'clientX' in evt ? evt.clientX : (evt as TouchEvent).touches[0].clientX;
    lastPosY.value = 'clientX' in evt ? evt.clientY : (evt as TouchEvent).touches[0].clientY;
  }
  else {
    const pointer = canvas.value.getPointer(evt);
    startX.value = pointer.x;
    startY.value = pointer.y;

    if (!dragTools.includes(fabricStore.activeTool)) {
      fabricObj.value = markRaw(createFabricObject(fabricStore.activeTool, {
        left: startX.value,
        top: startY.value,
        stroke: 'black',
        strokeWidth: 1,
        fill: 'transparent',
      }, {
        startPoints: [startX.value, startY.value],
      }));
      if (fabricObj.value) {
        canvas.value.add(fabricObj.value);
      }
    }
  }
}

function handleMouseMove(opt: TPointerEventInfo<TPointerEvent>) {
  const evt = opt.e;
  if (isMouseDown.value) {
    isDragging.value = true;
  }

  if (!isDragging.value || !canvas.value) return;

  if (fabricStore.activeTool === 'move') {
    const vpt = canvas.value.viewportTransform;
    if ('clientX' in evt) {
      vpt[4] += evt.clientX - (lastPosX.value);
      vpt[5] += evt.clientY - (lastPosY.value);
      lastPosX.value = evt.clientX;
      lastPosY.value = evt.clientY;
    }
    else {
      vpt[4] += evt.touches[0].clientX - (lastPosX.value);
      vpt[5] += evt.touches[0].clientY - (lastPosY.value);
      lastPosX.value = evt.touches[0].clientX;
      lastPosY.value = evt.touches[0].clientY;
    }
    canvas.value.requestRenderAll();
  }
  else {
    const pointer = canvas.value.getPointer(evt);
    const width = pointer.x - (startX.value);
    const height = pointer.y - (startY.value);
    const rx = Math.abs(pointer.x - (startX.value)) / 2; // Half width
    const ry = Math.abs(pointer.y - (startY.value)) / 2; // Half height
    const left = Math.min(pointer.x, startX.value);
    const top = Math.min(pointer.y, startY.value);

    if (fabricObj.value && !dragTools.includes(fabricStore.activeTool)) {
      switch (fabricObj.value.type) {
        case 'rect':
        case 'triangle':
          fabricObj.value.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startX.value : startX.value - Math.abs(width),
            top: height > 0 ? startY.value : startY.value - Math.abs(height),
          });
          break;
        case 'ellipse':
          fabricObj.value.set({
            left: left,
            top: top,
            // radius: Math.sqrt((pointer.x - (startX.value || 0)) ** 2 + (pointer.y - (startY.value || 0)) ** 2) / 2,
            rx,
            ry: shiftState.value ? rx : ry,
          });
          break;
        case 'circle':
          fabricObj.value.set({
            top: pointer.y - 6,
            left: pointer.x - 6,
          });
          if ('updateLinePosition' in fabricObj.value) {
            if (fabricStore.activeTool === 'line3') {
              (fabricObj.value as any).updateLinePosition(fabricObj.value, true);
            }
            else {
              (fabricObj.value as any).updateLinePosition(fabricObj.value);
            }
          }
          break;
        case 'line':
          fabricObj.value.set({
            x2: pointer.x,
            y2: pointer.y,
          });
          break;
      }
      fabricObj.value.setCoords();
      canvas.value.renderAll();
    }
  }
}

function handleMouseUp() {
  try {
    if (!canvas.value) return;
    if (!isDragging.value && fabricObj.value && (fabricObj.value.width < 2 || fabricObj.value.height < 2)) {
      canvas.value.remove(fabricObj.value);
      return;
    }
    if (isDragging.value) {
      if (fabricObj.value && !dragTools.includes(fabricStore.activeTool)) {
        fabricStore.setActiveTool('select');
        canvas.value.setActiveObject(fabricObj.value);
        fabricObj.value = null;
      }

      // if (fabricStore.activeTool !== 'move') {
      //   canvas.value.forEachObject((obj) => {
      //     // get prevSelectable and prevEvented
      //     console.log(obj.prevSelectable);
      //     obj.selectable = (obj as any).prevSelectable ?? true;
      //     obj.evented = (obj as any).prevEvented ?? true;
      //   });
      //   canvas.value.renderAll();
      // }
    }
  }
  catch (error) {
    console.error(error);
  }
  finally {
    isMouseDown.value = false;
    isDragging.value = false;
  }
}

onMounted(() => {
  if (!canvasElement.value) {
    return;
  }
  fabricStore.init(canvasElement.value);

  if (!canvas.value) {
    return;
  }
  canvas.value.on('mouse:wheel', handleZoomCanvas);

  canvas.value.on('mouse:down', handleMouseDown);

  canvas.value.on('mouse:move', handleMouseMove);

  canvas.value.on('mouse:up', handleMouseUp);
});
</script>

<template>
  <div class="w-full h-full">
    <canvas
      id="canvas"
      ref="canvasElement"
      class="w-full h-full"
    />
  </div>
</template>
