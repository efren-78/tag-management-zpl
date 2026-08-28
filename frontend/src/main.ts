import type { LabelElement } from './types';
import { generateZplCode, extractVariables } from './zplGenerator';
import { parseZplCode, detectZplBounds } from './zplParser';
import { convertImageToZplHex } from './imageConverter';
import { zplToBase64Async } from 'zpl-renderer-js';
// @ts-ignore
import { zpl2svg } from 'zpl2svg';
// @ts-ignore
import * as bwipjs from 'bwip-js';

// Expose dependencies to window for zpl2svg offline rendering
(window as any).bwipjs = bwipjs;

// State Management
let elements: LabelElement[] = [];
let selectedElementId: string | null = null;
let widthInches = 4;
let heightInches = 3;
let dpi = 203;
let zoom = 1.0;
let testVariables: Record<string, string> = {};
let loadedRawZpl: string | null = null;

// Canvas drag-and-drop state
let isDragging = false;
let isResizing = false;
let startX = 0;
let startY = 0;
let originalX = 0;
let originalY = 0;
let originalWidth = 0;
let originalHeight = 0;
let dragElementId: string | null = null;

// DOM Selections
const zplCanvas = document.getElementById('zpl-canvas') as HTMLDivElement;
const zplCanvasGrid = document.getElementById('zpl-canvas-grid') as HTMLDivElement;
const layersList = document.getElementById('layers-list') as HTMLDivElement;

// Inputs & Global Settings
const inputWidth = document.getElementById('label-width') as HTMLInputElement;
const inputHeight = document.getElementById('label-height') as HTMLInputElement;
const selectDpi = document.getElementById('label-dpi') as HTMLSelectElement;

// Zoom
const zoomValue = document.getElementById('zoom-value') as HTMLSpanElement;
const btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement;
const btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement;
const btnZoomFit = document.getElementById('btn-zoom-fit') as HTMLButtonElement;

// Buttons
const btnLoadPrn = document.getElementById('btn-load-prn') as HTMLInputElement;
const btnExportJson = document.getElementById('btn-export-json') as HTMLButtonElement;
const btnExportZpl = document.getElementById('btn-export-zpl') as HTMLButtonElement;

// Tool Buttons
const toolBtns = document.querySelectorAll('.tool-btn');
const imageUploadHelper = document.getElementById('image-upload-helper') as HTMLInputElement;

// Properties Form
const noSelectionMsg = document.getElementById('no-selection-msg') as HTMLDivElement;
const propertiesForm = document.getElementById('properties-form') as HTMLFormElement;
const propId = document.getElementById('prop-id') as HTMLInputElement;
const propX = document.getElementById('prop-x') as HTMLInputElement;
const propY = document.getElementById('prop-y') as HTMLInputElement;
const propFontSizeH = document.getElementById('prop-font-size-h') as HTMLInputElement;
const propFontSizeW = document.getElementById('prop-font-size-w') as HTMLInputElement;
const propBcHeight = document.getElementById('prop-bc-height') as HTMLInputElement;
const propBcRatio = document.getElementById('prop-bc-ratio') as HTMLInputElement;
const propContent = document.getElementById('prop-content') as HTMLTextAreaElement;
const propRotation = document.getElementById('prop-rotation') as HTMLSelectElement;
const propSequential = document.getElementById('prop-sequential') as HTMLInputElement;
const propSeqStart = document.getElementById('prop-seq-start') as HTMLInputElement;
const seqPropsGroup = document.querySelector('.sequential-props') as HTMLDivElement;
const btnDeleteElement = document.getElementById('btn-delete-element') as HTMLButtonElement;

// Realtime Output Textarea
const zplOutput = document.getElementById('zpl-output') as HTMLTextAreaElement;

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabProperties = document.getElementById('tab-properties') as HTMLDivElement;
const tabPreview = document.getElementById('tab-preview') as HTMLDivElement;

// Preview Tab
const previewVariablesContainer = document.getElementById('preview-variables-container') as HTMLDivElement;
const previewVariablesInputs = document.getElementById('preview-variables-inputs') as HTMLDivElement;
const localPreviewCanvas = document.getElementById('local-preview-canvas') as HTMLDivElement;

// Fullscreen Zoom Modal
const previewModal = document.getElementById('preview-modal') as HTMLDivElement;
const btnOpenModal = document.getElementById('btn-open-modal') as HTMLButtonElement;
const btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement;
const modalBackdrop = document.getElementById('modal-backdrop') as HTMLDivElement;
const modalPreviewCanvas = document.getElementById('modal-preview-canvas') as HTMLDivElement;
const btnToggleRotate = document.getElementById('btn-toggle-rotate') as HTMLButtonElement;
const btnToggleRotateTab = document.getElementById('btn-toggle-rotate-tab') as HTMLButtonElement;
let isRotated180 = false;

// Initialize Editor with default mock elements
function init() {
  elements = [
    {
      id: 'text_product',
      type: 'text',
      x: 50,
      y: 50,
      width: 300,
      height: 40,
      rotation: 'N',
      content: 'PRODUCTO: {{nombre_producto}}',
      fontSizeH: 40,
      fontSizeW: 40
    },
    {
      id: 'text_serial',
      type: 'text',
      x: 50,
      y: 110,
      width: 250,
      height: 30,
      rotation: 'N',
      content: 'SERIAL: {{num_serie}}',
      fontSizeH: 30,
      fontSizeW: 30
    },
    {
      id: 'barcode_main',
      type: 'barcode',
      x: 50,
      y: 170,
      width: 400,
      height: 120,
      rotation: 'N',
      content: 'PROD-{{codigo}}',
      barcodeType: '128',
      barcodeRatio: 2,
      barcodeHeight: 90
    }
  ];

  // Set default variable values
  testVariables = {
    nombre_producto: 'VÁLVULA DE PRESIÓN 3/4',
    num_serie: '002345',
    codigo: '987654321'
  };

  setupEventListeners();
  updateCanvasDimensions();
  render();
}

// Event bindings
function setupEventListeners() {
  // Global params
  inputWidth.addEventListener('input', () => {
    widthInches = parseFloat(inputWidth.value) || 4;
    updateCanvasDimensions();
    render();
  });
  inputHeight.addEventListener('input', () => {
    heightInches = parseFloat(inputHeight.value) || 3;
    updateCanvasDimensions();
    render();
  });
  selectDpi.addEventListener('change', () => {
    dpi = parseInt(selectDpi.value, 10) || 203;
    updateCanvasDimensions();
    render();
  });

  // Zoom controls
  btnZoomIn.addEventListener('click', () => {
    zoom = Math.min(zoom + 0.1, 3.0);
    updateZoom();
  });
  btnZoomOut.addEventListener('click', () => {
    zoom = Math.max(zoom - 0.1, 0.3);
    updateZoom();
  });
  btnZoomFit.addEventListener('click', () => {
    // Fit canvas in scroll area (width and height)
    const container = zplCanvas.parentElement as HTMLDivElement;
    if (container) {
      const parentWidth = container.clientWidth - 80;
      const parentHeight = container.clientHeight - 80;
      const canvasWidth = widthInches * dpi;
      const canvasHeight = heightInches * dpi;
      zoom = Math.min(parentWidth / canvasWidth, parentHeight / canvasHeight, 1.5);
      updateZoom();
    }
  });

  // Tools Selection
  toolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool');
      if (tool) addElement(tool);
    });
  });

  // Image Upload helper
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
            elements.push({
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
            selectedElementId = id;
            render();
          } catch (err) {
            alert('Error al convertir la imagen: ' + (err as Error).message);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  });

  // Properties Form edit callbacks
  const formFields = [propX, propY, propFontSizeH, propFontSizeW, propBcHeight, propBcRatio, propContent, propRotation, propSequential, propSeqStart];
  formFields.forEach((field) => {
    field.addEventListener('input', () => {
      updateSelectedElementProperties();
    });
  });

  propSequential.addEventListener('change', () => {
    if (propSequential.checked) {
      seqPropsGroup.classList.remove('hidden');
    } else {
      seqPropsGroup.classList.add('hidden');
    }
    updateSelectedElementProperties();
  });

  btnDeleteElement.addEventListener('click', () => {
    if (selectedElementId) {
      elements = elements.filter((el) => el.id !== selectedElementId);
      selectedElementId = null;
      render();
    }
  });

  // File loading
  btnLoadPrn.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        try {
          const parsed = await parseZplCode(text);
          elements = parsed.elements;
          widthInches = parsed.widthInches;
          heightInches = parsed.heightInches;
          dpi = parsed.dpi;

          // Sync inputs
          inputWidth.value = widthInches.toString();
          inputHeight.value = heightInches.toString();
          selectDpi.value = dpi.toString();

          loadedRawZpl = text;
          selectedElementId = null;
          updateCanvasDimensions();
          render();
          setTimeout(() => btnZoomFit.click(), 50);
        } catch (err) {
          alert('Error al analizar el archivo ZPL: ' + (err as Error).message);
        }
      };
      reader.readAsText(file);
    }
  });

  // File exports
  btnExportJson.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      widthInches,
      heightInches,
      dpi,
      elements
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'label_template.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  btnExportZpl.addEventListener('click', () => {
    const zplText = generateZplCode(elements, widthInches, heightInches, dpi);
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(zplText);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'label_output.prn');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Tab switcher
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');

      if (tab === 'properties') {
        tabProperties.classList.remove('hidden');
        tabPreview.classList.add('hidden');
      } else {
        tabProperties.classList.add('hidden');
        tabPreview.classList.remove('hidden');
        buildVariablesPreviewInputs();
        updateLocalPreview();
      }
    });
  });

  // Modal Open/Close Event Listeners
  btnOpenModal.addEventListener('click', () => {
    if (previewModal) {
      previewModal.classList.remove('hidden');
      // Force immediate render in modal scale context
      setTimeout(updateModalPreview, 50);
    }
  });

  const closeModalFunc = () => {
    if (previewModal) previewModal.classList.add('hidden');
  };
  btnCloseModal.addEventListener('click', closeModalFunc);
  modalBackdrop.addEventListener('click', closeModalFunc);

  // 180 Rotation toggle listeners
  const toggleRotateFunc = () => {
    isRotated180 = !isRotated180;
    if (btnToggleRotate) btnToggleRotate.classList.toggle('btn-primary', isRotated180);
    if (btnToggleRotateTab) btnToggleRotateTab.classList.toggle('btn-primary', isRotated180);
    updateLocalPreview();
    if (previewModal && !previewModal.classList.contains('hidden')) {
      updateModalPreview();
    }
  };
  if (btnToggleRotate) btnToggleRotate.addEventListener('click', toggleRotateFunc);
  if (btnToggleRotateTab) btnToggleRotateTab.addEventListener('click', toggleRotateFunc);

  // Global mouse listeners for dragging outside canvas
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // ResizeObserver for automatic real-time adaptive scaling on panel resize
  if (typeof ResizeObserver !== 'undefined') {
    const localContainer = document.querySelector('.preview-render-area');
    if (localContainer) {
      const observer = new ResizeObserver(() => {
        updateLocalPreview();
      });
      observer.observe(localContainer);
    }

    const modalContainer = document.getElementById('modal-preview-canvas-container');
    if (modalContainer) {
      const observer = new ResizeObserver(() => {
        if (previewModal && !previewModal.classList.contains('hidden')) {
          updateModalPreview();
        }
      });
      observer.observe(modalContainer);
    }
  }
}

// Size calculations
function updateCanvasDimensions() {
  const widthDots = widthInches * dpi;
  const heightDots = heightInches * dpi;

  zplCanvas.style.width = `${widthDots * zoom}px`;
  zplCanvas.style.height = `${heightDots * zoom}px`;
}

function updateZoom() {
  zoomValue.textContent = `${Math.round(zoom * 100)}%`;
  updateCanvasDimensions();
  render();
}

// Canvas items rendering
function render() {
  // Clear elements in canvas container except for grid
  const canvasChildren = zplCanvas.querySelectorAll('.canvas-element');
  canvasChildren.forEach((child) => child.remove());

  // Render elements
  elements.forEach((el) => {
    const div = document.createElement('div');
    div.className = `canvas-element ${selectedElementId === el.id ? 'selected' : ''}`;
    div.id = el.id;
    
    // Position
    div.style.left = `${el.x * zoom}px`;
    div.style.top = `${el.y * zoom}px`;
    div.style.width = `${el.width * zoom}px`;
    div.style.height = `${el.height * zoom}px`;

    // Rotation
    let rotationDeg = 0;
    if (el.rotation === 'R') rotationDeg = 90;
    else if (el.rotation === 'I') rotationDeg = 180;
    else if (el.rotation === 'B') rotationDeg = 270;
    div.style.transform = `rotate(${rotationDeg}deg)`;

    // Specific inner representations
    if (el.type === 'text') {
      const span = document.createElement('span');
      span.className = 'canvas-element-text';
      span.textContent = el.content;
      // Heuristic scaling font size to dots
      const scaleH = (el.fontSizeH || 30) * zoom;
      span.style.fontSize = `${scaleH * 0.75}px`;
      div.appendChild(span);
    } 
    else if (el.type === 'barcode') {
      const bSim = document.createElement('div');
      bSim.className = 'canvas-element-barcode';
      bSim.style.width = '100%';
      bSim.style.height = '100%';

      const stripes = document.createElement('div');
      stripes.className = 'barcode-sim-stripes';
      
      const bText = document.createElement('div');
      bText.className = 'barcode-sim-text';
      bText.textContent = el.content;
      bText.style.fontSize = `${10 * zoom}px`;

      bSim.appendChild(stripes);
      bSim.appendChild(bText);
      div.appendChild(bSim);
    } 
    else if (el.type === 'rect') {
      div.className += ' canvas-element-rect';
    } 
    else if (el.type === 'image') {
      div.className += ' canvas-element-image';
      if (el.imageSrc) {
        const img = document.createElement('img');
        img.src = el.imageSrc;
        div.appendChild(img);
      }
    }

    // Selected state handles
    if (selectedElementId === el.id) {
      const handle = document.createElement('div');
      handle.className = 'canvas-element-handle handle-se';
      handle.addEventListener('mousedown', (e) => startResize(e, el.id));
      div.appendChild(handle);
    }

    // Selection & Drag listeners
    div.addEventListener('mousedown', (e) => {
      // Prevent selection trigger on resize handle click
      if ((e.target as HTMLElement).classList.contains('canvas-element-handle')) {
        return;
      }
      e.stopPropagation();
      selectElement(el.id);
      startDrag(e, el.id);
    });

    zplCanvas.appendChild(div);
  });

  // Empty canvas selection reset
  zplCanvas.addEventListener('mousedown', (e) => {
    if (e.target === zplCanvas || e.target === zplCanvasGrid) {
      selectedElementId = null;
      render();
    }
  });

  updateLayersList();
  updatePropertiesPanel();
  
  // Realtime generated ZPL
  zplOutput.value = generateZplCode(elements, widthInches, heightInches, dpi);
  updateLocalPreview();
  
  // Synchronize modal preview if currently visible
  if (previewModal && !previewModal.classList.contains('hidden')) {
    updateModalPreview();
  }
}

// Add element template types
function addElement(type: string) {
  const id = `${type}_${Date.now()}`;
  let newEl: LabelElement;

  if (type === 'text') {
    newEl = {
      id,
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 35,
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
      y: 100,
      width: 300,
      height: 100,
      rotation: 'N',
      content: '12345678',
      barcodeType: '128',
      barcodeRatio: 2,
      barcodeHeight: 80
    };
  } else if (type === 'rect') {
    newEl = {
      id,
      type: 'rect',
      x: 100,
      y: 100,
      width: 150,
      height: 80,
      rotation: 'N',
      content: ''
    };
  } else if (type === 'image') {
    // Triggers hidden uploader helper
    imageUploadHelper.click();
    return;
  } else {
    return;
  }

  elements.push(newEl);
  selectedElementId = id;
  render();
}

function selectElement(id: string) {
  selectedElementId = id;
  render();
}

// Properties sync from model to form
function updatePropertiesPanel() {
  const el = elements.find((e) => e.id === selectedElementId);
  if (!el) {
    noSelectionMsg.classList.remove('hidden');
    propertiesForm.classList.add('hidden');
    return;
  }

  noSelectionMsg.classList.add('hidden');
  propertiesForm.classList.remove('hidden');

  propId.value = el.id;
  propX.value = el.x.toString();
  propY.value = el.y.toString();
  propRotation.value = el.rotation;
  
  // Show/Hide specific field types based on element selection type
  const textFields = document.querySelectorAll('.text-props-only');
  const barcodeFields = document.querySelectorAll('.barcode-props-only');
  const textOrBcFields = document.querySelectorAll('.text-or-bc-props');

  if (el.type === 'text') {
    textFields.forEach((f) => f.classList.remove('hidden'));
    barcodeFields.forEach((f) => f.classList.add('hidden'));
    textOrBcFields.forEach((f) => f.classList.remove('hidden'));

    propFontSizeH.value = (el.fontSizeH || 30).toString();
    propFontSizeW.value = (el.fontSizeW || 30).toString();
    propContent.value = el.content;
    propSequential.checked = el.isSequential || false;
    propSeqStart.value = (el.seqStart !== undefined ? el.seqStart : 1).toString();

    if (el.isSequential) {
      seqPropsGroup.classList.remove('hidden');
    } else {
      seqPropsGroup.classList.add('hidden');
    }
  } 
  else if (el.type === 'barcode') {
    textFields.forEach((f) => f.classList.add('hidden'));
    barcodeFields.forEach((f) => f.classList.remove('hidden'));
    textOrBcFields.forEach((f) => f.classList.remove('hidden'));

    propBcHeight.value = (el.barcodeHeight || 80).toString();
    propBcRatio.value = (el.barcodeRatio || 2).toString();
    propContent.value = el.content;
    seqPropsGroup.classList.add('hidden');
  } 
  else {
    textFields.forEach((f) => f.classList.add('hidden'));
    barcodeFields.forEach((f) => f.classList.add('hidden'));
    textOrBcFields.forEach((f) => f.classList.add('hidden'));
    seqPropsGroup.classList.add('hidden');
  }
}

// Properties sync from form inputs to model
function updateSelectedElementProperties() {
  if (!selectedElementId) return;

  const elIndex = elements.findIndex((e) => e.id === selectedElementId);
  if (elIndex === -1) return;

  const el = elements[elIndex];

  // Update positions
  el.x = parseInt(propX.value, 10) || 0;
  el.y = parseInt(propY.value, 10) || 0;
  el.rotation = propRotation.value as 'N' | 'R' | 'I' | 'B';

  if (el.type === 'text') {
    el.fontSizeH = parseInt(propFontSizeH.value, 10) || 30;
    el.fontSizeW = parseInt(propFontSizeW.value, 10) || 30;
    el.content = propContent.value;
    el.isSequential = propSequential.checked;
    el.seqStart = parseInt(propSeqStart.value, 10) || 1;
    // Adapt estimated width
    el.width = Math.round(el.content.length * (el.fontSizeW * 0.7));
    el.height = el.fontSizeH;
  } 
  else if (el.type === 'barcode') {
    el.barcodeHeight = parseInt(propBcHeight.value, 10) || 80;
    el.barcodeRatio = parseInt(propBcRatio.value, 10) || 2;
    el.content = propContent.value;
    el.height = el.barcodeHeight + 20;
    el.width = el.barcodeType === 'QR' ? 120 : el.barcodeRatio * el.content.length * 12;
  }

  // Redraw canvas element specifically
  const itemDiv = document.getElementById(el.id);
  if (itemDiv) {
    itemDiv.style.left = `${el.x * zoom}px`;
    itemDiv.style.top = `${el.y * zoom}px`;
    itemDiv.style.width = `${el.width * zoom}px`;
    itemDiv.style.height = `${el.height * zoom}px`;

    let rotationDeg = 0;
    if (el.rotation === 'R') rotationDeg = 90;
    else if (el.rotation === 'I') rotationDeg = 180;
    else if (el.rotation === 'B') rotationDeg = 270;
    itemDiv.style.transform = `rotate(${rotationDeg}deg)`;

    if (el.type === 'text') {
      const textSpan = itemDiv.querySelector('.canvas-element-text') as HTMLSpanElement;
      if (textSpan) {
        textSpan.textContent = el.content;
        textSpan.style.fontSize = `${(el.fontSizeH || 30) * zoom * 0.75}px`;
      }
    } 
    else if (el.type === 'barcode') {
      const barcodeText = itemDiv.querySelector('.barcode-sim-text') as HTMLDivElement;
      if (barcodeText) barcodeText.textContent = el.content;
    }
  }

  // Sync ZPL, layers list and previews
  zplOutput.value = generateZplCode(elements, widthInches, heightInches, dpi);
  updateLayersList();
  updateLocalPreview();
  if (previewModal && !previewModal.classList.contains('hidden')) {
    updateModalPreview();
  }
}

// Sidebar layers panel updater
function updateLayersList() {
  layersList.innerHTML = '';
  
  elements.forEach((el) => {
    const item = document.createElement('div');
    item.className = `layer-item ${selectedElementId === el.id ? 'active' : ''}`;
    
    const labelText = el.type === 'rect' ? 'Forma' : el.type === 'image' ? 'Logo/Imagen' : el.content;

    item.innerHTML = `
      <div class="layer-name">
        <span class="layer-type-badge">${el.type}</span>
        <span>${labelText.length > 18 ? labelText.substring(0, 16) + '...' : labelText}</span>
      </div>
      <div class="layer-actions">
        <button class="layer-btn delete-btn" title="Eliminar layer">&times;</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      // Do not trigger select if deleting
      if ((e.target as HTMLElement).classList.contains('delete-btn')) {
        return;
      }
      selectElement(el.id);
    });

    const deleteBtn = item.querySelector('.delete-btn') as HTMLButtonElement;
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements = elements.filter((itemEl) => itemEl.id !== el.id);
      if (selectedElementId === el.id) selectedElementId = null;
      render();
    });

    layersList.appendChild(item);
  });
}

// Drag & Drop operations handlers
function startDrag(e: MouseEvent, id: string) {
  isDragging = true;
  dragElementId = id;
  startX = e.clientX;
  startY = e.clientY;
  
  const el = elements.find((item) => item.id === id);
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

  const el = elements.find((item) => item.id === id);
  if (el) {
    originalWidth = el.width;
    originalHeight = el.height;
  }
}

function onMouseMove(e: MouseEvent) {
  if (!dragElementId) return;

  const el = elements.find((item) => item.id === dragElementId);
  if (!el) return;

  const dx = (e.clientX - startX) / zoom;
  const dy = (e.clientY - startY) / zoom;

  if (isDragging) {
    // Snap positions to grid boundary (1 dot limits)
    el.x = Math.max(0, Math.round(originalX + dx));
    el.y = Math.max(0, Math.round(originalY + dy));
    
    // Sync forms
    if (selectedElementId === dragElementId) {
      propX.value = el.x.toString();
      propY.value = el.y.toString();
    }

    // Instantly move canvas box
    const div = document.getElementById(el.id);
    if (div) {
      div.style.left = `${el.x * zoom}px`;
      div.style.top = `${el.y * zoom}px`;
    }
  } 
  else if (isResizing) {
    el.width = Math.max(10, Math.round(originalWidth + dx));
    el.height = Math.max(10, Math.round(originalHeight + dy));

    const div = document.getElementById(el.id);
    if (div) {
      div.style.width = `${el.width * zoom}px`;
      div.style.height = `${el.height * zoom}px`;
    }
  }
}

function onMouseUp() {
  if (isDragging || isResizing) {
    isDragging = false;
    isResizing = false;
    dragElementId = null;
    
    // Regenerate ZPL and sync layout fully
    zplOutput.value = generateZplCode(elements, widthInches, heightInches, dpi);
    updatePropertiesPanel();
  }
}

// Variables setup for the Preview tab
function buildVariablesPreviewInputs() {
  const vars = extractVariables(elements);
  
  if (vars.length === 0) {
    previewVariablesContainer.classList.add('hidden');
    return;
  }

  previewVariablesContainer.classList.remove('hidden');
  previewVariablesInputs.innerHTML = '';

  vars.forEach((variable) => {
    // Ensure initial test value exists
    if (testVariables[variable] === undefined) {
      testVariables[variable] = `[${variable}]`;
    }

    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label for="var-preview-${variable}">${variable}</label>
      <input type="text" id="var-preview-${variable}" value="${testVariables[variable]}" />
    `;

    const input = group.querySelector('input') as HTMLInputElement;
    input.addEventListener('input', () => {
      testVariables[variable] = input.value;
      zplOutput.value = generateZplCode(elements, widthInches, heightInches, dpi);
      updateLocalPreview();
      if (previewModal && !previewModal.classList.contains('hidden')) {
        updateModalPreview();
      }
    });

    previewVariablesInputs.appendChild(group);
  });
}

// Render a clean local print preview offline using zpl-renderer-js
async function updateLocalPreview() {
  if (!localPreviewCanvas) return;

  // Detect min/max coordinates and calculate dynamic top offset
  const rawZplString = loadedRawZpl || generateZplCode(elements, widthInches, heightInches, dpi, testVariables);
  const bounds = detectZplBounds(rawZplString, Math.round(widthInches * dpi), Math.round(heightInches * dpi), dpi);
  
  let zpl = rawZplString;
  const ltCommand = `^LT${bounds.topOffsetDots}\n`;
  if (zpl.includes('^LT')) {
    zpl = zpl.replace(/\^LT\d+/, `^LT${bounds.topOffsetDots}`);
  } else {
    zpl = zpl.replace('^XA', `^XA\n${ltCommand}`);
  }

  // Clear previous preview
  localPreviewCanvas.innerHTML = '';

  // Get dimensions in dots (use bounds.widthDots and bounds.heightDots for precise scaling)
  const widthDots = bounds.widthDots;
  const heightDots = bounds.heightDots;

  const container = localPreviewCanvas.parentElement as HTMLDivElement;
  let scale = 1;
  if (container && container.clientWidth > 0 && container.clientHeight > 0) {
    const parentWidth = Math.max(50, container.clientWidth - 24);
    const parentHeight = Math.max(50, container.clientHeight - 24);
    scale = Math.min(parentWidth / widthDots, parentHeight / heightDots, 1);
  }

  const displayWidth = Math.max(20, Math.round(widthDots * scale));
  const displayHeight = Math.max(20, Math.round(heightDots * scale));

  // Set style
  localPreviewCanvas.style.width = `${displayWidth}px`;
  localPreviewCanvas.style.height = `${displayHeight}px`;
  localPreviewCanvas.style.position = 'relative';
  localPreviewCanvas.style.backgroundColor = '#ffffff';
  localPreviewCanvas.style.overflow = 'hidden';
  localPreviewCanvas.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.4)';
  localPreviewCanvas.style.transform = 'none';

  try {
    const widthMm = widthInches * 25.4;
    const heightMm = heightInches * 25.4;
    const dpmm = dpi / 25.4;

    const base64Png = await zplToBase64Async(zpl, widthMm, heightMm, dpmm, { grayscaleOutput: true });
    const imgSrc = base64Png.startsWith('data:') ? base64Png : `data:image/png;base64,${base64Png}`;

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.style.width = '100%';
    imgEl.style.height = '100%';
    imgEl.style.objectFit = 'fill';
    imgEl.style.display = 'block';
    if (isRotated180) {
      imgEl.style.transform = 'rotate(180deg)';
    }

    localPreviewCanvas.appendChild(imgEl);
  } catch (err) {
    console.warn('zpl-renderer-js preview failed, falling back to zpl2svg:', err);
    try {
      const svgString = zpl2svg(zpl, { width: widthDots, height: heightDots });
      localPreviewCanvas.innerHTML = svgString;
      const svgEl = localPreviewCanvas.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
        svgEl.style.display = 'block';
      }
    } catch (fallbackErr) {
      console.error('Error rendering ZPL preview:', fallbackErr);
      localPreviewCanvas.innerHTML = `<div style="color: red; padding: 20px; font-size: 12px; font-family: monospace;">Error al generar vista previa offline: ${(fallbackErr as Error).message}</div>`;
    }
  }
}

// Render a larger print preview inside the fullscreen modal
async function updateModalPreview() {
  if (!modalPreviewCanvas) return;

  // Detect min/max coordinates and calculate dynamic top offset
  const rawZplString = loadedRawZpl || generateZplCode(elements, widthInches, heightInches, dpi, testVariables);
  const bounds = detectZplBounds(rawZplString, Math.round(widthInches * dpi), Math.round(heightInches * dpi), dpi);
  
  let zpl = rawZplString;
  const ltCommand = `^LT${bounds.topOffsetDots}\n`;
  if (zpl.includes('^LT')) {
    zpl = zpl.replace(/\^LT\d+/, `^LT${bounds.topOffsetDots}`);
  } else {
    zpl = zpl.replace('^XA', `^XA\n${ltCommand}`);
  }

  // Clear previous preview
  modalPreviewCanvas.innerHTML = '';

  // Get dimensions in dots (use bounds.widthDots and bounds.heightDots for precise scaling)
  const widthDots = bounds.widthDots;
  const heightDots = bounds.heightDots;

  const container = modalPreviewCanvas.parentElement as HTMLDivElement;
  let scale = 1;
  if (container && container.clientWidth > 0 && container.clientHeight > 0) {
    const parentWidth = Math.max(50, container.clientWidth - 40);
    const parentHeight = Math.max(50, container.clientHeight - 40);
    scale = Math.min(parentWidth / widthDots, parentHeight / heightDots, 1);
  }

  const displayWidth = Math.max(40, Math.round(widthDots * scale));
  const displayHeight = Math.max(40, Math.round(heightDots * scale));

  // Set style
  modalPreviewCanvas.style.width = `${displayWidth}px`;
  modalPreviewCanvas.style.height = `${displayHeight}px`;
  modalPreviewCanvas.style.position = 'relative';
  modalPreviewCanvas.style.backgroundColor = '#ffffff';
  modalPreviewCanvas.style.overflow = 'hidden';
  modalPreviewCanvas.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';
  modalPreviewCanvas.style.transform = 'none';

  try {
    const widthMm = widthInches * 25.4;
    const heightMm = heightInches * 25.4;
    const dpmm = dpi / 25.4;

    const base64Png = await zplToBase64Async(zpl, widthMm, heightMm, dpmm, { grayscaleOutput: true });
    const imgSrc = base64Png.startsWith('data:') ? base64Png : `data:image/png;base64,${base64Png}`;

    const imgEl = document.createElement('img');
    imgEl.src = imgSrc;
    imgEl.style.width = '100%';
    imgEl.style.height = '100%';
    imgEl.style.objectFit = 'fill';
    imgEl.style.display = 'block';
    if (isRotated180) {
      imgEl.style.transform = 'rotate(180deg)';
    }

    modalPreviewCanvas.appendChild(imgEl);
  } catch (err) {
    console.warn('zpl-renderer-js modal preview failed, falling back to zpl2svg:', err);
    try {
      const svgString = zpl2svg(zpl, { width: widthDots, height: heightDots });
      modalPreviewCanvas.innerHTML = svgString;
      const svgEl = modalPreviewCanvas.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
        svgEl.style.display = 'block';
      }
    } catch (fallbackErr) {
      console.error('Error rendering modal ZPL preview:', fallbackErr);
      modalPreviewCanvas.innerHTML = `<div style="color: red; padding: 20px; font-size: 12px; font-family: monospace;">Error al generar vista previa offline: ${(fallbackErr as Error).message}</div>`;
    }
  }
}

// Run app init
window.addEventListener('DOMContentLoaded', init);
