import { state } from '../state';
import type { LabelElement, ZplMediaConfig } from '../types';
import { showToast } from '../ui/toast';

export interface HistorySnapshot {
  elements: LabelElement[];
  selectedElementId: string | null;
  widthInches: number;
  heightInches: number;
  dpi: number;
  testVariables: Record<string, string>;
  loadedRawZpl: string | null;
  mediaConfig: ZplMediaConfig;
}

const MAX_HISTORY = 50;
const undoStack: HistorySnapshot[] = [];
const redoStack: HistorySnapshot[] = [];
let isApplyingHistory = false;

function createSnapshot(): HistorySnapshot {
  return {
    elements: JSON.parse(JSON.stringify(state.elements)),
    selectedElementId: state.selectedElementId,
    widthInches: state.widthInches,
    heightInches: state.heightInches,
    dpi: state.dpi,
    testVariables: { ...state.testVariables },
    loadedRawZpl: state.loadedRawZpl,
    mediaConfig: { ...state.mediaConfig },
  };
}

/**
 * Registra el estado actual en la pila de historial para permitir deshacer cambios.
 */
export function recordSnapshot() {
  if (isApplyingHistory) return;

  const snap = createSnapshot();

  // Evitar duplicar snapshots idénticos consecutivos
  if (undoStack.length > 0) {
    const last = undoStack[undoStack.length - 1];
    if (
      JSON.stringify(last.elements) === JSON.stringify(snap.elements) &&
      last.widthInches === snap.widthInches &&
      last.heightInches === snap.heightInches &&
      last.dpi === snap.dpi &&
      JSON.stringify(last.mediaConfig) === JSON.stringify(snap.mediaConfig) &&
      last.loadedRawZpl === snap.loadedRawZpl
    ) {
      return;
    }
  }

  undoStack.push(snap);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }

  // Limpiar la pila de rehacer al registrar una nueva acción del usuario
  redoStack.length = 0;
  updateHistoryButtonsUI();
}

/**
 * Revierte al estado anterior de la pila de historial (Deshacer).
 */
export function undo(onRestored?: () => void) {
  if (undoStack.length <= 1) {
    showToast('Deshacer', 'No hay más cambios para deshacer.', 'info');
    return;
  }

  isApplyingHistory = true;

  // Mover estado actual a redoStack
  const currentSnap = undoStack.pop()!;
  redoStack.push(currentSnap);

  // Restaurar estado anterior
  const targetSnap = undoStack[undoStack.length - 1];
  applySnapshot(targetSnap);

  isApplyingHistory = false;
  updateHistoryButtonsUI();
  onRestored?.();
  showToast('Deshacer', 'Cambio deshecho (Ctrl + Z)', 'info');
}

/**
 * Reaplica el estado siguiente de la pila de historial (Rehacer).
 */
export function redo(onRestored?: () => void) {
  if (redoStack.length === 0) {
    showToast('Rehacer', 'No hay más cambios para rehacer.', 'info');
    return;
  }

  isApplyingHistory = true;

  const nextSnap = redoStack.pop()!;
  undoStack.push(nextSnap);

  applySnapshot(nextSnap);

  isApplyingHistory = false;
  updateHistoryButtonsUI();
  onRestored?.();
  showToast('Rehacer', 'Cambio rehecho (Ctrl + Y)', 'info');
}

/**
 * Aplica un snapshot sobre el estado activo de la aplicación.
 */
function applySnapshot(snap: HistorySnapshot) {
  state.elements = JSON.parse(JSON.stringify(snap.elements));
  state.selectedElementId = snap.selectedElementId;
  state.widthInches = snap.widthInches;
  state.heightInches = snap.heightInches;
  state.dpi = snap.dpi;
  state.testVariables = { ...snap.testVariables };
  state.loadedRawZpl = snap.loadedRawZpl;
  state.mediaConfig = { ...snap.mediaConfig };

  // Sincronizar inputs del encabezado
  const inputWidth = document.getElementById('label-width') as HTMLInputElement;
  const inputHeight = document.getElementById('label-height') as HTMLInputElement;
  const selectDpi = document.getElementById('label-dpi') as HTMLSelectElement;

  if (inputWidth) inputWidth.value = state.widthInches.toString();
  if (inputHeight) inputHeight.value = state.heightInches.toString();
  if (selectDpi) selectDpi.value = state.dpi.toString();
}

/**
 * Actualiza la apariencia y el estado habilitado/deshabilitado de los botones en la interfaz.
 */
export function updateHistoryButtonsUI() {
  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement;

  if (btnUndo) {
    const canUndo = undoStack.length > 1;
    btnUndo.disabled = !canUndo;
    btnUndo.classList.toggle('btn-disabled', !canUndo);
    btnUndo.title = canUndo
      ? `Deshacer (${undoStack.length - 1} cambios) [Ctrl + Z]`
      : 'Deshacer (Ctrl + Z)';
  }

  if (btnRedo) {
    const canRedo = redoStack.length > 0;
    btnRedo.disabled = !canRedo;
    btnRedo.classList.toggle('btn-disabled', !canRedo);
    btnRedo.title = canRedo
      ? `Rehacer (${redoStack.length} disponibles) [Ctrl + Y]`
      : 'Rehacer (Ctrl + Y)';
  }
}

/**
 * Inicializa los botones de interfaz para Deshacer / Rehacer.
 */
export function initHistoryUI(callbacks: { onStateRestored: () => void }) {
  if (undoStack.length === 0) {
    undoStack.push(createSnapshot());
    updateHistoryButtonsUI();
  }

  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');

  btnUndo?.addEventListener('click', () => {
    undo(callbacks.onStateRestored);
  });

  btnRedo?.addEventListener('click', () => {
    redo(callbacks.onStateRestored);
  });
}
