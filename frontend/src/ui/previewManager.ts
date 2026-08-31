import { state } from '../state';
import { generateZplCode, extractVariables } from '../zplGenerator';
import { zplToBase64Async } from 'zpl-renderer-js';
// @ts-ignore
import { zpl2svg } from 'zpl2svg';

let isModalRotated = false;

export function initPreviewManager() {
  const btnOpenModal = document.getElementById('btn-open-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const previewModal = document.getElementById('preview-modal');
  const btnToggleRotate = document.getElementById('btn-toggle-rotate');
  const btnToggleRotateTab = document.getElementById('btn-toggle-rotate-tab');

  const closeModal = () => {
    previewModal?.classList.add('hidden');
  };

  const openModal = () => {
    previewModal?.classList.remove('hidden');
    updateModalPreview();
  };

  const toggleRotation = () => {
    isModalRotated = !isModalRotated;
    updateModalPreview();
    updateLocalPreview();
  };

  btnOpenModal?.addEventListener('click', openModal);
  btnCloseModal?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);
  btnToggleRotate?.addEventListener('click', toggleRotation);
  btnToggleRotateTab?.addEventListener('click', toggleRotation);
}

export function buildVariablesPreviewInputs(onVariableChange?: () => void) {
  const container = document.getElementById('preview-variables-container');
  const inputsContainer = document.getElementById('preview-variables-inputs');
  if (!container || !inputsContainer) return;

  const detectedVars = extractVariables(state.elements);

  if (detectedVars.length === 0) {
    container.classList.add('hidden');
    inputsContainer.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  inputsContainer.innerHTML = '';

  detectedVars.forEach((varName) => {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = varName;
    label.htmlFor = `var-input-${varName}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `var-input-${varName}`;
    input.value = state.testVariables[varName] || '';
    input.placeholder = `Valor de ${varName}`;

    input.addEventListener('input', () => {
      state.testVariables[varName] = input.value;
      updateLocalPreview();
      updateModalPreview();
      onVariableChange?.();
    });

    group.appendChild(label);
    group.appendChild(input);
    inputsContainer.appendChild(group);
  });
}

export async function updateLocalPreview() {
  const previewCanvas = document.getElementById('local-preview-canvas');
  if (!previewCanvas) return;

  const currentZpl = state.loadedRawZpl || generateZplCode(
    state.elements,
    state.widthInches,
    state.heightInches,
    state.dpi,
    state.testVariables,
    state.mediaConfig
  );

  // Apply rotation CSS if active
  previewCanvas.style.transform = isModalRotated ? 'rotate(180deg)' : 'none';
  previewCanvas.style.transition = 'transform 0.3s ease';

  try {
    // 1. Try offline SVG rendering
    const svgResult = zpl2svg(currentZpl);
    if (svgResult && svgResult.length > 0) {
      previewCanvas.innerHTML = svgResult;
      return;
    }
  } catch {
    // fallback to zpl-renderer-js
  }

  try {
    // 2. Fallback to zplToBase64Async
    const dpmm = state.dpi === 300 ? 12 : state.dpi === 600 ? 24 : 8;
    const base64 = await zplToBase64Async(currentZpl, dpmm, state.widthInches, state.heightInches);
    if (base64) {
      previewCanvas.innerHTML = `<img src="${base64}" alt="Vista previa ZPL" style="max-width:100%; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.3);" />`;
    }
  } catch (err: any) {
    previewCanvas.innerHTML = `<div style="padding:16px; color:#f87171; font-size:12px;">Error al renderizar vista previa: ${err.message || err}</div>`;
  }
}

export async function updateModalPreview() {
  const modalCanvas = document.getElementById('modal-preview-canvas');
  const previewModal = document.getElementById('preview-modal');
  if (!modalCanvas || !previewModal || previewModal.classList.contains('hidden')) return;

  const currentZpl = state.loadedRawZpl || generateZplCode(
    state.elements,
    state.widthInches,
    state.heightInches,
    state.dpi,
    state.testVariables,
    state.mediaConfig
  );

  modalCanvas.style.transform = isModalRotated ? 'rotate(180deg)' : 'none';
  modalCanvas.style.transition = 'transform 0.3s ease';

  try {
    const svgResult = zpl2svg(currentZpl);
    if (svgResult && svgResult.length > 0) {
      modalCanvas.innerHTML = svgResult;
      return;
    }
  } catch {
    // fallback
  }

  try {
    const dpmm = state.dpi === 300 ? 12 : state.dpi === 600 ? 24 : 8;
    const base64 = await zplToBase64Async(currentZpl, dpmm, state.widthInches, state.heightInches);
    if (base64) {
      modalCanvas.innerHTML = `<img src="${base64}" alt="Vista previa ZPL" style="max-width:100%;" />`;
    }
  } catch (err: any) {
    modalCanvas.innerHTML = `<div style="padding:16px; color:#f87171;">Error al renderizar: ${err.message || err}</div>`;
  }
}
