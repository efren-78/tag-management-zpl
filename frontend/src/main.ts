import { state } from './state';
import { generateZplCode } from './zplGenerator';
import { parseZplCode } from './zplParser';
// @ts-ignore
import * as bwipjs from 'bwip-js';

import { showToast } from './ui/toast';
import { initPrinterModal, syncModalZpl } from './ui/printerModal';
import { initZplDiagnosticsUI, runZplValidation } from './ui/zplDiagnosticsUI';
import {
  initPreviewManager,
  updateLocalPreview,
  updateModalPreview,
  buildVariablesPreviewInputs,
} from './ui/previewManager';
import {
  initCanvasManager,
  renderCanvas,
  updateCanvasDimensions,
  updateZoom,
} from './ui/canvasManager';
import { initHistoryUI, recordSnapshot } from './services/historyManager';
import { initShortcutManager } from './services/shortcutManager';

// Expose dependencies to window for offline rendering
(window as any).bwipjs = bwipjs;

// DOM Header & Global Selectors
const inputWidth = document.getElementById('label-width') as HTMLInputElement;
const inputHeight = document.getElementById('label-height') as HTMLInputElement;
const selectDpi = document.getElementById('label-dpi') as HTMLSelectElement;
const btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement;
const btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement;
const btnZoomFit = document.getElementById('btn-zoom-fit') as HTMLButtonElement;
const btnLoadPrn = document.getElementById('btn-load-prn') as HTMLInputElement;
const btnExportJson = document.getElementById('btn-export-json') as HTMLButtonElement;
const btnExportZpl = document.getElementById('btn-export-zpl') as HTMLButtonElement;
const zplOutput = document.getElementById('zpl-output') as HTMLTextAreaElement;

// Tab switcher selectors
const tabBtns = document.querySelectorAll('.tab-btn');
const tabProperties = document.getElementById('tab-properties') as HTMLDivElement;
const tabPreview = document.getElementById('tab-preview') as HTMLDivElement;

// Media Specification Selectors
const headerMediaDimensions = document.getElementById('header-media-dimensions');
const headerMediaTypeBadge = document.getElementById('header-media-type-badge');
const headerMediaRibbonBadge = document.getElementById('header-media-ribbon-badge');
const mediaDotsBadge = document.getElementById('media-dots-badge');
const selectMediaTracking = document.getElementById('select-media-tracking') as HTMLSelectElement;
const selectMediaType = document.getElementById('select-media-type') as HTMLSelectElement;
const selectPrintMode = document.getElementById('select-print-mode') as HTMLSelectElement;
const selectPrintSpeed = document.getElementById('select-print-speed') as HTMLSelectElement;
const inputMediaDarkness = document.getElementById('input-media-darkness') as HTMLInputElement;
const inputTopOffset = document.getElementById('input-top-offset') as HTMLInputElement;

/**
 * Updates header badges and media specifications card.
 */
export function syncMediaConfigUI() {
  const widthMm = Math.round(state.widthInches * 25.4);
  const heightMm = Math.round(state.heightInches * 25.4);
  const widthDots = Math.round(state.widthInches * state.dpi);
  const heightDots = Math.round(state.heightInches * state.dpi);

  if (headerMediaDimensions) {
    headerMediaDimensions.textContent = `${state.widthInches.toFixed(2)}" x ${state.heightInches.toFixed(2)}" (${widthMm}x${heightMm} mm)`;
  }
  if (mediaDotsBadge) {
    mediaDotsBadge.textContent = `${widthDots} x ${heightDots} dots (${state.dpi} DPI)`;
  }

  if (headerMediaTypeBadge) {
    switch (state.mediaConfig.mediaTracking) {
      case 'web':
        headerMediaTypeBadge.textContent = '📜 Sensor Web (^MNW)';
        break;
      case 'continuous':
        headerMediaTypeBadge.textContent = '📜 Continuo (^MNN)';
        break;
      case 'black_mark':
        headerMediaTypeBadge.textContent = '📜 Marca Negra (^MNM)';
        break;
      case 'auto':
        headerMediaTypeBadge.textContent = '📜 Auto (^MNA)';
        break;
      default:
        headerMediaTypeBadge.textContent = '📜 Hueco / Gap (^MNY)';
        break;
    }
  }

  if (headerMediaRibbonBadge) {
    headerMediaRibbonBadge.textContent =
      state.mediaConfig.mediaType === 'direct_thermal' ? '🖨️ Térmica Directa (^MTD)' : '🖨️ Con Ribbon (^MTT)';
  }

  if (selectMediaTracking) selectMediaTracking.value = state.mediaConfig.mediaTracking;
  if (selectMediaType) selectMediaType.value = state.mediaConfig.mediaType;
  if (selectPrintMode) selectPrintMode.value = state.mediaConfig.printMode;
  if (selectPrintSpeed && state.mediaConfig.printSpeed) {
    selectPrintSpeed.value = state.mediaConfig.printSpeed.toString();
  }
  if (inputMediaDarkness && state.mediaConfig.darkness !== undefined) {
    inputMediaDarkness.value = state.mediaConfig.darkness.toString();
  }
  if (inputTopOffset && state.mediaConfig.topOffsetDots !== undefined) {
    inputTopOffset.value = state.mediaConfig.topOffsetDots.toString();
  }
}

/**
 * Main application render cycle.
 */
export function renderAll() {
  renderCanvas();

  // Generate real-time ZPL output
  const generatedZpl = generateZplCode(
    state.elements,
    state.widthInches,
    state.heightInches,
    state.dpi,
    state.testVariables,
    state.mediaConfig
  );

  if (zplOutput) {
    zplOutput.value = state.loadedRawZpl || generatedZpl;
  }

  syncMediaConfigUI();
  updateLocalPreview();
  syncModalZpl();
  runZplValidation(zplOutput?.value || generatedZpl);

  const previewModal = document.getElementById('preview-modal');
  if (previewModal && !previewModal.classList.contains('hidden')) {
    updateModalPreview();
  }
}

/**
 * Initialize all modules and attach top-level event listeners.
 */
function init() {
  // 1. Initialize Subsystem Modules
  initCanvasManager({
    onCanvasChange: () => {
      renderAll();
    },
  });

  initZplDiagnosticsUI({
    getCurrentZpl: () => zplOutput?.value || '',
    onZplUpdate: (newZpl) => {
      state.loadedRawZpl = newZpl;
      if (zplOutput) zplOutput.value = newZpl;
      recordSnapshot();
      syncModalZpl();
      updateLocalPreview();
    },
  });

  initPreviewManager();
  initPrinterModal();

  initHistoryUI({
    onStateRestored: () => {
      updateCanvasDimensions();
      renderAll();
    },
  });

  initShortcutManager({
    onStateRestored: () => {
      updateCanvasDimensions();
      renderAll();
    },
  });

  // 2. Attach Global Header & Dimension Listeners
  inputWidth.addEventListener('input', () => {
    state.widthInches = parseFloat(inputWidth.value) || 4;
    state.loadedRawZpl = null;
    updateCanvasDimensions();
    renderAll();
  });
  inputWidth.addEventListener('change', () => {
    recordSnapshot();
  });

  inputHeight.addEventListener('input', () => {
    state.heightInches = parseFloat(inputHeight.value) || 3;
    state.loadedRawZpl = null;
    updateCanvasDimensions();
    renderAll();
  });
  inputHeight.addEventListener('change', () => {
    recordSnapshot();
  });

  selectDpi.addEventListener('change', () => {
    state.dpi = parseInt(selectDpi.value, 10) || 203;
    state.loadedRawZpl = null;
    updateCanvasDimensions();
    renderAll();
    recordSnapshot();
  });

  // Zoom Controls
  btnZoomIn.addEventListener('click', () => {
    state.zoom = Math.min(state.zoom + 0.1, 3.0);
    updateZoom();
  });

  btnZoomOut.addEventListener('click', () => {
    state.zoom = Math.max(state.zoom - 0.1, 0.3);
    updateZoom();
  });

  btnZoomFit.addEventListener('click', () => {
    const zplCanvas = document.getElementById('zpl-canvas');
    const container = zplCanvas?.parentElement as HTMLDivElement;
    if (container) {
      const parentWidth = container.clientWidth - 80;
      const parentHeight = container.clientHeight - 80;
      const canvasWidth = state.widthInches * state.dpi;
      const canvasHeight = state.heightInches * state.dpi;
      state.zoom = Math.min(parentWidth / canvasWidth, parentHeight / canvasHeight, 1.5);
      updateZoom();
    }
  });

  // 3. Media & Hardware Specification Dropdowns
  selectMediaTracking?.addEventListener('change', () => {
    state.mediaConfig.mediaTracking = selectMediaTracking.value as any;
    state.loadedRawZpl = null;
    recordSnapshot();
    renderAll();
    showToast('Sensor de Papel Actualizado', `Configurado como ${selectMediaTracking.options[selectMediaTracking.selectedIndex].text}`, 'info');
  });

  selectMediaType?.addEventListener('change', () => {
    state.mediaConfig.mediaType = selectMediaType.value as any;
    state.loadedRawZpl = null;
    recordSnapshot();
    renderAll();
    showToast('Tipo de Impresión Actualizado', `Configurado como ${selectMediaType.options[selectMediaType.selectedIndex].text}`, 'info');
  });

  selectPrintMode?.addEventListener('change', () => {
    state.mediaConfig.printMode = selectPrintMode.value as any;
    state.loadedRawZpl = null;
    recordSnapshot();
    renderAll();
  });

  selectPrintSpeed?.addEventListener('change', () => {
    const speed = parseInt(selectPrintSpeed.value, 10);
    if (!isNaN(speed)) {
      state.mediaConfig.printSpeed = speed;
      state.loadedRawZpl = null;
      recordSnapshot();
      renderAll();
      showToast('Velocidad Actualizada', `Configurada como ${speed} ips (^PR${speed})`, 'info');
    }
  });

  inputMediaDarkness?.addEventListener('change', () => {
    const val = parseInt(inputMediaDarkness.value, 10);
    if (!isNaN(val)) {
      state.mediaConfig.darkness = val;
      state.loadedRawZpl = null;
      recordSnapshot();
      renderAll();
    }
  });

  inputTopOffset?.addEventListener('change', () => {
    const val = parseInt(inputTopOffset.value, 10);
    if (!isNaN(val)) {
      state.mediaConfig.topOffsetDots = val;
      state.loadedRawZpl = null;
      recordSnapshot();
      renderAll();
      showToast('Offset Superior Actualizado', `Configurado a ${val} dots (^LT${val})`, 'info');
    }
  });

  // 4. File Load (.PRN / .ZPL)
  btnLoadPrn.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        try {
          const parsed = await parseZplCode(text, state.dpi);
          state.elements = parsed.elements;
          state.widthInches = parsed.widthInches;
          state.heightInches = parsed.heightInches;
          state.dpi = parsed.dpi;
          if (parsed.mediaConfig) {
            state.mediaConfig = parsed.mediaConfig;
          }

          inputWidth.value = state.widthInches.toString();
          inputHeight.value = state.heightInches.toString();
          selectDpi.value = state.dpi.toString();

          state.loadedRawZpl = text;
          state.selectedElementId = null;

          recordSnapshot();
          updateCanvasDimensions();
          renderAll();

          setTimeout(() => {
            btnZoomFit?.click();
          }, 60);

          const trackingLabel =
            state.mediaConfig.mediaTracking === 'continuous' ? 'Continuo' :
            state.mediaConfig.mediaTracking === 'black_mark' ? 'Marca Negra' : 'Con Hueco (Gap)';
          const typeLabel = state.mediaConfig.mediaType === 'direct_thermal' ? 'Térmica Directa' : 'Transferencia Térmica';

          showToast(
            'Archivo Cargado y Adaptado',
            `Medidas: ${state.widthInches.toFixed(2)}" x ${state.heightInches.toFixed(2)}" (${Math.round(state.widthInches * 25.4)}x${Math.round(state.heightInches * 25.4)} mm). Papel: ${trackingLabel}, Cinta: ${typeLabel}.`,
            'success'
          );
        } catch (err: any) {
          showToast('Error al analizar ZPL', err.message || 'Formato no soportado', 'error');
        }
      };
      reader.readAsText(file);
    }
  });

  // 5. File Exports (JSON & ZPL/PRN)
  btnExportJson.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      widthInches: state.widthInches,
      heightInches: state.heightInches,
      dpi: state.dpi,
      elements: state.elements,
      mediaConfig: state.mediaConfig
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'label_template.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  btnExportZpl.addEventListener('click', () => {
    const zplText = state.loadedRawZpl || generateZplCode(
      state.elements,
      state.widthInches,
      state.heightInches,
      state.dpi,
      state.testVariables,
      state.mediaConfig
    );
    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(zplText);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'label_output.prn');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // 6. Tab Switcher (Properties vs Preview)
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
        buildVariablesPreviewInputs(() => {
          updateLocalPreview();
        });
        updateLocalPreview();
      }
    });
  });

  // 7. Initial Canvas Setup
  updateCanvasDimensions();
  renderAll();
}

// Start application
init();
