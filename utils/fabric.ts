import { Triangle, type FabricObjectProps, Rect, Circle, Line, Ellipse } from 'fabric';

// import { type ObjectEvents, type FabricObject, type Line, type Group, Circle, type Rect, type Ellipse, type Triangle, type FabricObjectProps, type SerializedObjectProps } from 'fabric';
import type { ToolType } from '~/types/toolbar';

// export function setupFabricMouseEvent(canvas: Canvas) {
//   canvas.on('mouse:wheel', function (opt) {
//     const delta = opt.e.deltaY;
//     let zoom = canvas.getZoom();
//     zoom *= 0.999 ** delta;
//     if (zoom > 20) zoom = 20;
//     if (zoom < 0.01) zoom = 0.01;
//     canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom);
//     opt.e.preventDefault();
//     opt.e.stopPropagation();
//   });

//   let isMouseDown = false;
//   let isDragging = false; // Track dragging state
//   let lastPosX: number, lastPosY: number; // Store last mouse positions
//   let startX: number, startY: number;
//   let fabricObj: FabricObject<Partial<FabricObjectProps>, SerializedObjectProps, ObjectEvents> | null = null;

//   const fabricStore = useFabricStore();
//   // Enable dragging when Shift key is pressed and mouse is down
//   canvas.on('mouse:down', function (opt) {
//     const evt = opt.e;
//     isMouseDown = true;
//     if (fabricStore.activeTool === 'move') {
//       canvas.selection = false; // Disable object selection
//       lastPosX = (evt as MouseEvent).clientX;
//       lastPosY = 'clientY' in evt ? evt.clientY : (evt as TouchEvent).touches[0].clientY;
//       // disable choose object
//       canvas.discardActiveObject();
//       canvas.forEachObject((obj) => {
//         console.log('Object', obj);
//         obj.selectable = false;
//         obj.evented = false;
//       });

//       // change cursor style to grabbing
//       canvas.renderAll();
//     }
//     else {
//       const pointer = canvas.getPointer(evt);
//       startX = pointer.x;
//       startY = pointer.y;
//       console.log('Start', startX, startY);
//       if (fabricStore.activeTool === 'triangle') {
//         fabricObj = new Rect({
//           width: 0,
//           height: 0,
//           fill: 'transparent',
//           stroke: 'black',
//           left: startX,
//           top: startY,
//         });

//         canvas.add(fabricObj);
//       }
//     }
//   });

//   // Handle dragging movement
//   canvas.on('mouse:move', function (opt) {
//     const fabricStore = useFabricStore();
//     const evt = opt.e;

//     if (isMouseDown) {
//       isDragging = true;
//     }

//     if (!isDragging) return;

//     if (fabricStore.activeTool === 'move') {
//       const vpt = canvas.viewportTransform;
//       if ('clientX' in evt) {
//         vpt[4] += evt.clientX - lastPosX; // Update horizontal translation
//         vpt[5] += evt.clientY - lastPosY; // Update vertical translation
//         lastPosX = evt.clientX;
//         lastPosY = evt.clientY;
//       }
//       else {
//         vpt[4] += evt.touches[0].clientX - lastPosX; // Update horizontal translation
//         vpt[5] += evt.touches[0].clientY - lastPosY; // Update vertical translation
//         lastPosX = evt.touches[0].clientX;
//         lastPosY = evt.touches[0].clientY;
//       }
//       canvas.requestRenderAll(); // Re-render the canvas
//       lastPosX = (evt as any).clientX;
//       lastPosY = (evt as any).clientY;
//     }

//     else {
//       canvas.selection = false; // Disable object selection
//       const pointer = canvas.getPointer(evt);
//       const width = pointer.x - startX;
//       const height = pointer.y - startY;

//       if (fabricObj && fabricStore.activeTool === 'triangle') {
//         fabricObj?.set({
//           width: Math.abs(width),
//           height: Math.abs(height),
//           left: width > 0 ? startX : startX - Math.abs(width),
//           top: height > 0 ? startY : startY - Math.abs(height),
//         });
//         canvas.renderAll();
//       }
//     }
//   });

//   // Stop dragging on mouse up
//   canvas.on('mouse:up', function () {
//     try {
//       canvas.selection = true; // Re-enable object selection
//       console.log('Mouse up', isDragging, fabricObj?.width, fabricObj?.height, (fabricObj && (fabricObj?.width < 20 || fabricObj?.height < 20)));
//       if (!isDragging && (fabricObj && (fabricObj.width < 2 || fabricObj.height < 2))) {
//         canvas.remove(fabricObj);
//         return;
//       }
//       if (isDragging) {
//         if (fabricStore.activeTool === 'triangle') {
//           canvas.setActiveObject(fabricObj);
//           fabricObj = null;
//         }

//         canvas.forEachObject((obj) => {
//           obj.selectable = true;
//           obj.evented = true;
//         });
//         canvas.renderAll();
//         fabricStore.setActiveTool('select');
//       }
//     }
//     catch (error) {
//       console.error(error);
//     }
//     finally {
//       isMouseDown = false;
//       isDragging = false;
//     }
//   });
// }
interface ObjectOptions {
  startPoints?: number[];
}
export function createFabricObject(type: ToolType, option: Partial<FabricObjectProps>, moreOptions?: Partial<ObjectOptions>) {
  const defaultOptions = {
    fill: 'transparent',
    stroke: 'black',
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  };

  const fabricStore = useFabricStore();

  const canvas = fabricStore.canvas;
  const options = { ...defaultOptions, ...option };
  switch (type) {
    case 'line':
      if (moreOptions?.startPoints) {
        const [x1, y1] = moreOptions.startPoints;

        const line = makeLine([x1, y1, x1, y1]);
        line.setCoords();

        const firstPoint = makeCircle(line.get('x1') - CIRCLE_RADIUS, line.get('y1') - CIRCLE_RADIUS, [line, line], 'start');
        const endPoint = makeCircle(line.get('x2'), line.get('y2'), [line, line], 'end');
        firstPoint.setCoords();
        canvas?.add(line);
        canvas?.add(firstPoint);
        canvas?.on('object:moving', function (e) {
          updateLinePosition(e.target);
        });

        // if selected then show all points, if deselected then hide all points
        line.on('mousedown', () => {
          [firstPoint, endPoint].forEach((p) => {
            p.set('visible', true);
          });
        });

        // if clicked outside of line then hide all points
        canvas?.on('mouse:down', function (e) {
          const target = e.target;

          if (!target) {
            [firstPoint, endPoint].forEach((p) => {
              p.set('visible', false);
            });
            canvas?.renderAll();
          };
        });

        Object.assign(endPoint, { updateLinePosition });

        // asign points to line
        Object.assign(line, { points: [firstPoint, endPoint] });
        return endPoint;
      }
      else
        return makeLine([100, 100, 100, 100]);

    case 'line3':
      if (moreOptions?.startPoints) {
        const [x1, y1] = moreOptions.startPoints;

        const line = makeLine([x1, y1, x1, y1]);
        const line2 = makeLine([x1, y1, x1, y1]);
        canvas?.add(line, line2);

        const firstPoint = makeCircle(line.get('x1') - CIRCLE_RADIUS, line.get('y1') - CIRCLE_RADIUS, [line, line2], 'start');
        const midPoint = makeCircle(line.get('x2'), line.get('y2'), [line, line2], 'mid');
        const endPoint = makeCircle(line.get('x2'), line.get('y2'), [line, line2], 'end');

        canvas?.add(firstPoint, midPoint);
        canvas?.on('object:moving', function (e) {
          updateLinePosition(e.target);
        });

        // if selected then show all points, if deselected then hide all points
        [line, line2].forEach((l) => {
          l.on('mousedown', () => {
            console.log('mousedown');
            [firstPoint, midPoint, endPoint].forEach((p) => {
              p.set('visible', true);
            });
          });
        });

        // if clicked outside of line then hide all points
        canvas?.on('mouse:down', function (e) {
          const target = e.target;

          console.log('mousedown', target);
          if (!target) {
            [firstPoint, midPoint, endPoint].forEach((p) => {
              p.set('visible', false);
            });
            canvas?.renderAll();
          };
        });

        Object.assign(endPoint, { updateLinePosition, midPoint: midPoint, points: [firstPoint, midPoint, endPoint] });
        return endPoint;
      }
      else
        return new Line([0, 0, 0, 0], options);

    case 'triangle':
      return new Triangle(options);

    case 'rect':
      return new Rect(options);

    case 'circle':
      return new Circle(options);

    case 'ellipse':
      return new Ellipse({ ...options, rx: 0, // Initial horizontal radius
        ry: 0, // Initial vertical radius
        fill: 'transparent', // Fill color
        stroke: 'black' });
    default:
      return new Rect(options);
  }
}
