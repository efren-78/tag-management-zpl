import { state } from '../state';
import type { LabelElement } from '../types';
import { undo, redo, recordSnapshot } from './historyManager';
import { showToast } from '../ui/toast';

export interface ShortcutManagerCallbacks {
  onStateRestored: () => void;
}

// Elemento almacenado en el portapapeles en memoria
let copiedElement: LabelElement | null = null;

/**
 * Copia el elemento actualmente seleccionado en memoria.
 */
export function copySelectedElement(): boolean {
  if (!state.selectedElementId) {
    showToast('Copiar', 'Selecciona un elemento en el lienzo primero.', 'info');
    return false;
  }

  const el = state.elements.find((item) => item.id === state.selectedElementId);
  if (!el) return false;

  copiedElement = JSON.parse(JSON.stringify(el));
  showToast('Elemento Copiado', 'Elemento copiado al portapapeles.', 'info');
  return true;
}

/**
 * Pega el elemento copiado en el lienzo con un desplazamiento visual (+20px, +20px).
 */
export function pasteElement(onRestored?: () => void): boolean {
  if (!copiedElement) {
    showToast('Pegar', 'No hay ningún elemento en el portapapeles para pegar.', 'info');
    return false;
  }

  const newId = `${copiedElement.type}_${Date.now()}`;
  const newEl: LabelElement = {
    ...JSON.parse(JSON.stringify(copiedElement)),
    id: newId,
    x: copiedElement.x + 20,
    y: copiedElement.y + 20,
  };

  state.elements.push(newEl);
  state.selectedElementId = newId;
  state.loadedRawZpl = null;

  // Actualizar copiedElement para que el siguiente pegado continúe desplazándose
  copiedElement.x += 20;
  copiedElement.y += 20;

  recordSnapshot();
  onRestored?.();
  showToast('Elemento Pegado', 'Elemento pegado en el lienzo.', 'success');
  return true;
}

/**
 * Duplica directamente el elemento seleccionado en un solo paso (Ctrl + D).
 */
export function duplicateSelectedElement(onRestored?: () => void): boolean {
  if (!state.selectedElementId) {
    showToast('Duplicar', 'Selecciona un elemento en el lienzo primero.', 'info');
    return false;
  }

  const el = state.elements.find((item) => item.id === state.selectedElementId);
  if (!el) return false;

  const newId = `${el.type}_${Date.now()}`;
  const newEl: LabelElement = {
    ...JSON.parse(JSON.stringify(el)),
    id: newId,
    x: el.x + 20,
    y: el.y + 20,
  };

  state.elements.push(newEl);
  state.selectedElementId = newId;
  state.loadedRawZpl = null;

  recordSnapshot();
  onRestored?.();
  showToast('Elemento Duplicado', 'Se creó un duplicado del elemento.', 'success');
  return true;
}

/**
 * Elimina el elemento seleccionado en el lienzo.
 */
export function deleteSelectedElement(onRestored?: () => void): boolean {
  if (!state.selectedElementId) return false;

  state.elements = state.elements.filter((el) => el.id !== state.selectedElementId);
  state.selectedElementId = null;
  state.loadedRawZpl = null;

  recordSnapshot();
  onRestored?.();
  showToast('Elemento Eliminado', 'Se eliminó el elemento seleccionado.', 'info');
  return true;
}

/**
 * Gestor centralizado de atajos de teclado (Keyboard Shortcuts) de la aplicación.
 */
export function initShortcutManager(callbacks: ShortcutManagerCallbacks) {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
    const activeEl = document.activeElement as HTMLElement | null;

    const isInputFocused =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable);

    // ──────────────────────────────────────────────
    // Shortcuts para el manejo de componentes y lienzo
    // ──────────────────────────────────────────────

    // 1. Deshacer: Ctrl + Z / Cmd + Z (sin Shift)
    if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (
        !isInputFocused ||
        activeEl?.id === 'zpl-canvas' ||
        activeEl?.id === 'label-width' ||
        activeEl?.id === 'label-height'
      ) {
        e.preventDefault();
        undo(callbacks.onStateRestored);
      }
      return;
    }

    // 2. Rehacer: Ctrl + Y / Cmd + Y / Ctrl + Shift + Z / Cmd + Shift + Z
    if (
      (isCtrlOrCmd && e.key.toLowerCase() === 'y') ||
      (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      if (
        !isInputFocused ||
        activeEl?.id === 'zpl-canvas' ||
        activeEl?.id === 'label-width' ||
        activeEl?.id === 'label-height'
      ) {
        e.preventDefault();
        redo(callbacks.onStateRestored);
      }
      return;
    }

    // 3. Eliminar elemento seleccionado: Supr / Delete / Backspace (fuera de inputs de texto)
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused) {
      if (state.selectedElementId) {
        e.preventDefault();
        deleteSelectedElement(callbacks.onStateRestored);
      }
      return;
    }

    // 4. Copiar elemento seleccionado: Ctrl + C / Cmd + C (fuera de inputs de texto)
    if (isCtrlOrCmd && e.key.toLowerCase() === 'c' && !e.shiftKey) {
      if (
        !isInputFocused ||
        activeEl?.id === 'zpl-canvas' ||
        activeEl?.id === 'label-width' ||
        activeEl?.id === 'label-height'
      ) {
        if (state.selectedElementId) {
          e.preventDefault();
          copySelectedElement();
        }
      }
      return;
    }

    // 5. Pegar elemento copiado: Ctrl + V / Cmd + V (fuera de inputs de texto)
    if (isCtrlOrCmd && e.key.toLowerCase() === 'v' && !e.shiftKey) {
      if (
        !isInputFocused ||
        activeEl?.id === 'zpl-canvas' ||
        activeEl?.id === 'label-width' ||
        activeEl?.id === 'label-height'
      ) {
        if (copiedElement) {
          e.preventDefault();
          pasteElement(callbacks.onStateRestored);
        }
      }
      return;
    }

    // 6. Duplicar elemento seleccionado en 1 paso: Ctrl + D / Cmd + D (fuera de inputs de texto)
    if (isCtrlOrCmd && e.key.toLowerCase() === 'd') {
      if (
        !isInputFocused ||
        activeEl?.id === 'zpl-canvas' ||
        activeEl?.id === 'label-width' ||
        activeEl?.id === 'label-height'
      ) {
        if (state.selectedElementId) {
          e.preventDefault();
          duplicateSelectedElement(callbacks.onStateRestored);
        }
      }
      return;
    }

    // ──────────────────────────────────────────────
    // Shortcuts para archivos y acciones globales
    // ──────────────────────────────────────────────

    // 1. Atajo rápido para Abrir Modal de Impresión: Ctrl + P / Cmd + P
    if (isCtrlOrCmd && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      const btnOpenPrinterModal = document.getElementById('btn-open-printer-modal');
      btnOpenPrinterModal?.click();
      return;
    }

    // 2. Atajo rápido para Exportar ZPL: Ctrl + S / Cmd + S
    if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const btnExportZpl = document.getElementById('btn-export-zpl');
      btnExportZpl?.click();
      showToast('Exportación ZPL', 'Descargando archivo ZPL/PRN generado.', 'success');
      return;
    }
  });
}
