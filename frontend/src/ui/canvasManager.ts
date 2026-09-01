import { state } from '../state';
import type { LabelElement } from '../types';
import { convertImageToZplHex } from '../imageConverter';
import { showToast } from './toast';
import { recordSnapshot } from '../services/historyManager';
import { duplicateSelectedElement } from '../services/shortcutManager';

// Drag & drop and resize interaction state
let isDragging = false;
let isResizing = false;
let startX = 0;
let startY = 0;
let originalX = 0;
let originalY = 0;
let originalWidth = 0;
let originalHeight = 0;
let dragElementId: string | null = null;

export interface CanvasManagerCallbacks {
  onCanvasChange: () => void;
}

let managerCallbacks: CanvasManagerCallbacks | null = null;

export function initCanvasManager(cb: CanvasManagerCallbacks) {
  managerCallbacks = cb;

  const zplCanvas = document.getElementById('zpl-canvas') as HTMLDivElement;
  const zplCanvasGrid = document.getElementById('zpl-canvas-grid') as HTMLDivElement;
  const imageUploadHelper = document.getElementById('image-upload-helper') as HTMLInputElement;
  const btnDeleteElement = document.getElementById('btn-delete-element') as HTMLButtonElement;
  const btnDuplicateElement = document.getElementById('btn-duplicate-element') as HTMLButtonElement;
  const propSequential = document.getElementById('prop-sequential') as HTMLInputElement;
  const seqPropsGroup = document.querySelector('.sequential-props') as HTMLDivElement;

  // Tool buttons
  const toolBtns = document.querySelectorAll('.tool-btn');
  toolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool');
      if (tool) addElement(tool);
    });
  });

  // Image Upload helper
  if (imageUploadHelper) {
    imageUploadHelper.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            try {
              const zplData = convertImageToZplHex(img);
              const id = `image_${Date.now()}`;
              state.elements.push({
                id,
                type: 'image',
                x: 100,
                y: 100,
                width: zplData.width,
                height: zplData.height,
                rotation: 'N',
                content: '',
                imageSrc: event.target?.result as string,
                zplHex: zplData.hexString,
                zplTotalBytes: zplData.totalBytes,
                zplRowBytes: zplData.rowBytes,
                zplImgWidth: zplData.width,
                zplImgHeight: zplData.height
              });
              state.selectedElementId = id;
              state.loadedRawZpl = null;
              recordSnapshot();
              renderCanvas();
              managerCallbacks?.onCanvasChange();
              showToast('Imagen Añadida', 'Se convirtió a formato nativo ^GF de Zebra.', 'success');
            } catch (err: any) {
              showToast('Error de Imagen', err.message || 'No se pudo procesar la imagen.', 'error');
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Properties Form edit callbacks
  const propIds = ['prop-x', 'prop-y', 'prop-font-size-h', 'prop-font-size-w', 'prop-bc-height', 'prop-bc-ratio', 'prop-content', 'prop-rotation', 'prop-sequential', 'prop-seq-start'];
  propIds.forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('input', () => {
      updateSelectedElementProperties();
    });
  });

  propSequential?.addEventListener('change', () => {
    if (propSequential.checked) {
      seqPropsGroup?.classList.remove('hidden');
    } else {
      seqPropsGroup?.classList.add('hidden');
    }
    updateSelectedElementProperties();
  });

  btnDeleteElement?.addEventListener('click', () => {
    if (state.selectedElementId) {
      state.elements = state.elements.filter((el) => el.id !== state.selectedElementId);
      state.selectedElementId = null;
      state.loadedRawZpl = null;
      recordSnapshot();
      renderCanvas();
      managerCallbacks?.onCanvasChange();
    }
  });

  btnDuplicateElement?.addEventListener('click', () => {
    duplicateSelectedElement(() => {
      renderCanvas();
      managerCallbacks?.onCanvasChange();
    });
  });

  // Global mouse listeners for Drag & Drop and Resizing
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  // Click on empty canvas clears selection
  if (zplCanvas) {
    zplCanvas.addEventListener('mousedown', (e) => {
      if (e.target === zplCanvas || e.target === zplCanvasGrid) {
        state.selectedElementId = null;
        renderCanvas();
      }
    });
  }
}

export function updateCanvasDimensions() {
  const zplCanvas = document.getElementById('zpl-canvas');
  if (!zplCanvas) return;

  const widthDots = Math.round(state.widthInches * state.dpi);
  const heightDots = Math.round(state.heightInches * state.dpi);

  zplCanvas.style.width = `${widthDots * state.zoom}px`;
  zplCanvas.style.height = `${heightDots * state.zoom}px`;
}

export function updateZoom() {
  const zoomVal = document.getElementById('zoom-value');
  if (zoomVal) {
    zoomVal.textContent = `${Math.round(state.zoom * 100)}%`;
  }
  updateCanvasDimensions();
  renderCanvas();
}

export function renderCanvas() {
  const zplCanvas = document.getElementById('zpl-canvas');
  if (!zplCanvas) return;

  // Clear previous elements except the grid
  const elementsToRemove = zplCanvas.querySelectorAll('.canvas-element');
  elementsToRemove.forEach((el) => el.remove());

  state.elements.forEach((el) => {
    const div = document.createElement('div');
    div.className = 'canvas-element';
    div.id = `canvas-el-${el.id}`;

    // Dimensions and position scaled with zoom
    div.style.left = `${el.x * state.zoom}px`;
    div.style.top = `${el.y * state.zoom}px`;
    div.style.width = `${el.width * state.zoom}px`;
    div.style.height = `${el.height * state.zoom}px`;

    // Handle rotation transform
    let rotateDeg = 0;
    if (el.rotation === 'R') rotateDeg = 90;
    else if (el.rotation === 'I') rotateDeg = 180;
    else if (el.rotation === 'B') rotateDeg = 270;
    div.style.transform = `rotate(${rotateDeg}deg)`;

    if (state.selectedElementId === el.id) {
      div.classList.add('selected');
      const handle = document.createElement('div');
      handle.className = 'canvas-element-handle';
      handle.addEventListener('mousedown', (e) => startResize(e, el.id));
      div.appendChild(handle);
    }

    // Specific inner representations
    if (el.type === 'text') {
      const span = document.createElement('span');
      span.className = 'canvas-element-text';
      span.textContent = el.content;
      const scaleH = (el.fontSizeH || 30) * state.zoom;
      span.style.fontSize = `${scaleH * 0.75}px`;
      div.appendChild(span);
    } else if (el.type === 'barcode') {
      const bSim = document.createElement('div');
      bSim.className = 'canvas-element-barcode';
      bSim.style.width = '100%';
      bSim.style.height = '100%';

      const stripes = document.createElement('div');
      stripes.className = 'barcode-sim-stripes';

      const bText = document.createElement('div');
      bText.className = 'barcode-sim-text';
      bText.textContent = el.content;
      bText.style.fontSize = `${10 * state.zoom}px`;

      bSim.appendChild(stripes);
      bSim.appendChild(bText);
      div.appendChild(bSim);
    } else if (el.type === 'rect') {
      div.className += ' canvas-element-rect';
    } else if (el.type === 'image') {
      div.className += ' canvas-element-image';
      if (el.imageSrc) {
        const img = document.createElement('img');
        img.src = el.imageSrc;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        div.appendChild(img);
      }
    }

    // Selection & Drag listeners
    div.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).classList.contains('canvas-element-handle')) return;
      e.stopPropagation();
      selectElement(el.id);
      startDrag(e, el.id);
    });

    zplCanvas.appendChild(div);
  });

  updateLayersList();
  updatePropertiesPanel();
}

export function selectElement(id: string | null) {
  state.selectedElementId = id;
  renderCanvas();
}

export function addElement(type: string) {
  const id = `${type}_${Date.now()}`;
  let newEl: LabelElement;

  if (type === 'text') {
    newEl = {
      id,
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      rotation: 'N',
      content: 'Nuevo Texto',
      fontSizeH: 30,
      fontSizeW: 30
    };
  } else if (type === 'barcode') {
    newEl = {
      id,
      type: 'barcode',
      x: 100,
      y: 150,
      width: 250,
      height: 80,
      rotation: 'N',
      content: '1234567890',
      barcodeType: '128',
      barcodeRatio: 2,
      barcodeHeight: 80
    };
  } else if (type === 'rect') {
    newEl = {
      id,
      type: 'rect',
      x: 80,
      y: 80,
      width: 200,
      height: 100,
      rotation: 'N',
      content: ''
    };
  } else if (type === 'image') {
    const uploadHelper = document.getElementById('image-upload-helper') as HTMLInputElement;
    uploadHelper?.click();
    return;
  } else {
    return;
  }

  state.elements.push(newEl);
  state.selectedElementId = id;
  state.loadedRawZpl = null;
  recordSnapshot();
  renderCanvas();
  managerCallbacks?.onCanvasChange();
}

function startDrag(e: MouseEvent, id: string) {
  isDragging = true;
  dragElementId = id;
  startX = e.clientX;
  startY = e.clientY;

  const el = state.elements.find((item) => item.id === id);
  if (el) {
    originalX = el.x;
    originalY = el.y;
  }
}

function startResize(e: MouseEvent, id: string) {
  e.stopPropagation();
  isResizing = true;
  dragElementId = id;
  startX = e.clientX;
  startY = e.clientY;

  const el = state.elements.find((item) => item.id === id);
  if (el) {
    originalWidth = el.width;
    originalHeight = el.height;
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging && !isResizing) return;

  const deltaX = (e.clientX - startX) / state.zoom;
  const deltaY = (e.clientY - startY) / state.zoom;

  const el = state.elements.find((item) => item.id === dragElementId);
  if (!el) return;

  if (isDragging) {
    el.x = Math.max(0, Math.round(originalX + deltaX));
    el.y = Math.max(0, Math.round(originalY + deltaY));
    state.loadedRawZpl = null;
    renderCanvas();
    managerCallbacks?.onCanvasChange();
  } else if (isResizing) {
    el.width = Math.max(10, Math.round(originalWidth + deltaX));
    el.height = Math.max(10, Math.round(originalHeight + deltaY));
    state.loadedRawZpl = null;
    renderCanvas();
    managerCallbacks?.onCanvasChange();
  }
}

function handleMouseUp() {
  if (isDragging || isResizing) {
    const el = state.elements.find((item) => item.id === dragElementId);
    if (
      el &&
      (el.x !== originalX ||
        el.y !== originalY ||
        el.width !== originalWidth ||
        el.height !== originalHeight)
    ) {
      recordSnapshot();
    }
    isDragging = false;
    isResizing = false;
    dragElementId = null;
  }
}

export function updatePropertiesPanel() {
  const form = document.getElementById('properties-form') as HTMLFormElement;
  const noSelectionMsg = document.getElementById('no-selection-msg') as HTMLDivElement;
  if (!form || !noSelectionMsg) return;

  if (!state.selectedElementId) {
    form.classList.add('hidden');
    noSelectionMsg.classList.remove('hidden');
    return;
  }

  const el = state.elements.find((item) => item.id === state.selectedElementId);
  if (!el) {
    form.classList.add('hidden');
    noSelectionMsg.classList.remove('hidden');
    return;
  }

  form.classList.remove('hidden');
  noSelectionMsg.classList.add('hidden');

  (document.getElementById('prop-id') as HTMLInputElement).value = el.id;
  (document.getElementById('prop-x') as HTMLInputElement).value = el.x.toString();
  (document.getElementById('prop-y') as HTMLInputElement).value = el.y.toString();
  (document.getElementById('prop-rotation') as HTMLSelectElement).value = el.rotation;
  (document.getElementById('prop-content') as HTMLTextAreaElement).value = el.content;

  const textProps = document.querySelectorAll('.text-props-only');
  const barcodeProps = document.querySelectorAll('.barcode-props-only');
  const textOrBcProps = document.querySelectorAll('.text-or-bc-props');
  const seqPropsGroup = document.querySelector('.sequential-props');

  if (el.type === 'text') {
    textProps.forEach((d) => d.classList.remove('hidden'));
    barcodeProps.forEach((d) => d.classList.add('hidden'));
    textOrBcProps.forEach((d) => d.classList.remove('hidden'));

    (document.getElementById('prop-font-size-h') as HTMLInputElement).value = (el.fontSizeH || 30).toString();
    (document.getElementById('prop-font-size-w') as HTMLInputElement).value = (el.fontSizeW || 30).toString();
    (document.getElementById('prop-sequential') as HTMLInputElement).checked = !!el.isSequential;

    if (el.isSequential) {
      seqPropsGroup?.classList.remove('hidden');
      (document.getElementById('prop-seq-start') as HTMLInputElement).value = (el.seqStart || 1).toString();
    } else {
      seqPropsGroup?.classList.add('hidden');
    }
  } else if (el.type === 'barcode') {
    textProps.forEach((d) => d.classList.add('hidden'));
    barcodeProps.forEach((d) => d.classList.remove('hidden'));
    textOrBcProps.forEach((d) => d.classList.remove('hidden'));

    (document.getElementById('prop-bc-height') as HTMLInputElement).value = (el.barcodeHeight || 80).toString();
    (document.getElementById('prop-bc-ratio') as HTMLInputElement).value = (el.barcodeRatio || 2).toString();
  } else {
    textProps.forEach((d) => d.classList.add('hidden'));
    barcodeProps.forEach((d) => d.classList.add('hidden'));
    textOrBcProps.forEach((d) => d.classList.add('hidden'));
  }
}

export function updateSelectedElementProperties() {
  if (!state.selectedElementId) return;
  const el = state.elements.find((item) => item.id === state.selectedElementId);
  if (!el) return;

  el.x = parseInt((document.getElementById('prop-x') as HTMLInputElement).value, 10) || 0;
  el.y = parseInt((document.getElementById('prop-y') as HTMLInputElement).value, 10) || 0;
  el.rotation = (document.getElementById('prop-rotation') as HTMLSelectElement).value as 'N' | 'R' | 'I' | 'B';
  el.content = (document.getElementById('prop-content') as HTMLTextAreaElement).value;

  if (el.type === 'text') {
    el.fontSizeH = parseInt((document.getElementById('prop-font-size-h') as HTMLInputElement).value, 10) || 30;
    el.fontSizeW = parseInt((document.getElementById('prop-font-size-w') as HTMLInputElement).value, 10) || 30;
    el.isSequential = (document.getElementById('prop-sequential') as HTMLInputElement).checked;
    if (el.isSequential) {
      el.seqStart = parseInt((document.getElementById('prop-seq-start') as HTMLInputElement).value, 10) || 1;
    }
  } else if (el.type === 'barcode') {
    el.barcodeHeight = parseInt((document.getElementById('prop-bc-height') as HTMLInputElement).value, 10) || 80;
    el.barcodeRatio = parseInt((document.getElementById('prop-bc-ratio') as HTMLInputElement).value, 10) || 2;
  }

  state.loadedRawZpl = null;
  recordSnapshot();
  renderCanvas();
  managerCallbacks?.onCanvasChange();
}

export function updateLayersList() {
  const layersList = document.getElementById('layers-list');
  if (!layersList) return;
  layersList.innerHTML = '';

  state.elements.slice().reverse().forEach((el) => {
    const item = document.createElement('div');
    item.className = `layer-item ${state.selectedElementId === el.id ? 'active' : ''}`;

    let icon = 'T';
    let label = el.content || el.id;
    if (el.type === 'barcode') icon = '█';
    else if (el.type === 'rect') {
      icon = '▬';
      label = `Rectángulo (${el.width}x${el.height})`;
    } else if (el.type === 'image') {
      icon = '🖼️';
      label = `Imagen (${el.width}x${el.height})`;
    }

    item.innerHTML = `
      <div class="layer-info">
        <span class="layer-icon">${icon}</span>
        <span class="layer-name" title="${label}">${label}</span>
      </div>
      <div class="layer-actions">
        <button class="layer-btn duplicate" title="Duplicar elemento (Ctrl + D)">📋</button>
        <button class="layer-btn delete" title="Eliminar elemento (Supr)">🗑️</button>
      </div>
    `;

    item.addEventListener('click', () => {
      selectElement(el.id);
    });

    const dupBtn = item.querySelector('.layer-btn.duplicate');
    dupBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectElement(el.id);
      duplicateSelectedElement(() => {
        renderCanvas();
        managerCallbacks?.onCanvasChange();
      });
    });

    const delBtn = item.querySelector('.layer-btn.delete');
    delBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      state.elements = state.elements.filter((itemEl) => itemEl.id !== el.id);
      if (state.selectedElementId === el.id) state.selectedElementId = null;
      state.loadedRawZpl = null;
      recordSnapshot();
      renderCanvas();
      managerCallbacks?.onCanvasChange();
    });

    layersList.appendChild(item);
  });
}
