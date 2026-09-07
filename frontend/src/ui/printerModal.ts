import { state } from '../state';
import { generateZplCode } from '../zplGenerator';
import {
  healthCheck,
  getAvailablePrinters,
  printViaUsb,
  printViaTcp,
  buildZplFromData,
  generateTestZpl,
} from '../services/printService';
import { showToast } from './toast';
import { latestValidationReport, runZplValidation } from './zplDiagnosticsUI';

interface PrintLogItem {
  time: string;
  target: string;
  success: boolean;
  message: string;
}

const printLogs: PrintLogItem[] = [];
let usbPrintersList: string[] = [];
let isBackendOnline: boolean | null = null;
let currentConnTab: 'conn-usb' | 'conn-tcp' | 'conn-api' = (localStorage.getItem('zpl_conn_tab') as any) || 'conn-usb';

export function initPrinterModal() {
  const btnOpenPrinterModal = document.getElementById('btn-open-printer-modal');
  const btnClosePrinterModal = document.getElementById('btn-close-printer-modal');
  const btnCancelPrint = document.getElementById('btn-cancel-print');
  const printerModalBackdrop = document.getElementById('printer-modal-backdrop');
  const btnRecheckBackend = document.getElementById('btn-recheck-backend');
  const backendStatusBadge = document.getElementById('backend-status-badge');
  const btnRefreshPrinters = document.getElementById('btn-refresh-printers');
  const selectUsbPrinter = document.getElementById('select-usb-printer') as HTMLSelectElement;
  const connTabBtns = document.querySelectorAll('.conn-tab-btn');
  const quickHostBtns = document.querySelectorAll('.btn-chip');
  const radioSourceModes = document.querySelectorAll('input[name="zpl-source-mode"]');
  const modalZplPreview = document.getElementById('modal-zpl-preview') as HTMLTextAreaElement;
  const btnSendPrint = document.getElementById('btn-send-print') as HTMLButtonElement;
  const btnTestPrint = document.getElementById('btn-test-print') as HTMLButtonElement;
  const btnGenerateApiZpl = document.getElementById('btn-generate-api-zpl') as HTMLButtonElement;
  const toggleLogsHeader = document.getElementById('toggle-logs-header');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  // Connection Tab Switching
  connTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab') as 'conn-usb' | 'conn-tcp' | 'conn-api';
      switchConnTab(tab);
    });
  });

  // Quick Host Chips
  quickHostBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const host = btn.getAttribute('data-host');
      const port = btn.getAttribute('data-port');
      const inputHost = document.getElementById('input-tcp-host') as HTMLInputElement;
      const inputPort = document.getElementById('input-tcp-port') as HTMLInputElement;
      if (host && inputHost) inputHost.value = host;
      if (port && inputPort) inputPort.value = port;
    });
  });

  // Source mode radio
  radioSourceModes.forEach((radio) => {
    radio.addEventListener('change', () => {
      syncModalZpl();
    });
  });

  // Live editing in modal ZPL preview
  modalZplPreview?.addEventListener('input', () => {
    const text = modalZplPreview.value;
    const byteCount = new Blob([text]).size;
    const lineCount = text.split('\n').length;
    const printZplStats = document.getElementById('print-zpl-stats');
    if (printZplStats) {
      printZplStats.textContent = `${byteCount} bytes | ${lineCount} líneas`;
    }
    runZplValidation(text);
  });

  // Printer select persistence
  selectUsbPrinter?.addEventListener('change', () => {
    if (selectUsbPrinter.value) {
      localStorage.setItem('zpl_selected_usb_printer', selectUsbPrinter.value);
    }
  });

  // Open / Close Modal
  btnOpenPrinterModal?.addEventListener('click', openPrinterModal);
  btnClosePrinterModal?.addEventListener('click', closePrinterModal);
  btnCancelPrint?.addEventListener('click', closePrinterModal);
  printerModalBackdrop?.addEventListener('click', closePrinterModal);

  // Backend status check clicks
  btnRecheckBackend?.addEventListener('click', () => checkBackendStatus(false));
  backendStatusBadge?.addEventListener('click', () => checkBackendStatus(false));
  btnRefreshPrinters?.addEventListener('click', () => loadUsbPrinters(false));

  // Print execution buttons
  btnSendPrint?.addEventListener('click', handleSendPrint);
  btnTestPrint?.addEventListener('click', handleTestPrint);
  btnGenerateApiZpl?.addEventListener('click', handleGenerateApiZpl);

  // Logs toggle
  toggleLogsHeader?.addEventListener('click', () => {
    const printLogsList = document.getElementById('print-logs-list');
    const logsArrow = document.getElementById('logs-arrow');
    if (printLogsList && logsArrow) {
      printLogsList.classList.toggle('open');
      logsArrow.textContent = printLogsList.classList.contains('open') ? '▲' : '▼';
    }
  });

  btnClearLogs?.addEventListener('click', (e) => {
    e.stopPropagation();
    printLogs.length = 0;
    renderPrintLogs();
    showToast('Historial Limpio', 'Se borraron los registros de impresión.', 'info');
  });

  // Initial check in background
  checkBackendStatus(true);
}

export function openPrinterModal() {
  const printerModal = document.getElementById('printer-modal');
  if (printerModal) {
    printerModal.classList.remove('hidden');
    syncModalZpl();
    checkBackendStatus(true).then((online) => {
      if (online && usbPrintersList.length === 0) {
        loadUsbPrinters(true);
      }
    });
  }
}

export function closePrinterModal() {
  const printerModal = document.getElementById('printer-modal');
  printerModal?.classList.add('hidden');
}

export function syncModalZpl(forceUpdateManual: boolean = false) {
  const designerElementsCount = document.getElementById('designer-elements-count');
  const modalZplPreview = document.getElementById('modal-zpl-preview') as HTMLTextAreaElement;
  const printZplStats = document.getElementById('print-zpl-stats');

  if (designerElementsCount) {
    designerElementsCount.textContent = state.elements.length.toString();
  }

  if (!modalZplPreview) return;

  const sourceMode = (document.querySelector('input[name="zpl-source-mode"]:checked') as HTMLInputElement)?.value || 'designer';

  if (sourceMode === 'designer' || forceUpdateManual) {
    const rawZpl = state.loadedRawZpl || generateZplCode(
      state.elements,
      state.widthInches,
      state.heightInches,
      state.dpi,
      state.testVariables,
      state.mediaConfig
    );
    modalZplPreview.value = rawZpl;
  }

  const text = modalZplPreview.value;
  const byteCount = new Blob([text]).size;
  const lineCount = text.split('\n').length;
  if (printZplStats) {
    printZplStats.textContent = `${byteCount} bytes | ${lineCount} líneas`;
  }

  runZplValidation(text);
}

export function getActiveZplForPrinting(): string {
  const sourceMode = (document.querySelector('input[name="zpl-source-mode"]:checked') as HTMLInputElement)?.value || 'designer';
  const modalZplPreview = document.getElementById('modal-zpl-preview') as HTMLTextAreaElement;
  const inputPrintCopies = document.getElementById('input-print-copies') as HTMLInputElement;

  let zpl = '';

  if (sourceMode === 'manual' && modalZplPreview && modalZplPreview.value.trim().length > 0) {
    zpl = modalZplPreview.value;
  } else {
    zpl = state.loadedRawZpl || generateZplCode(
      state.elements,
      state.widthInches,
      state.heightInches,
      state.dpi,
      state.testVariables,
      state.mediaConfig
    );
  }

  const copies = parseInt(inputPrintCopies?.value || '1', 10) || 1;
  if (copies > 1 && !zpl.includes('^PQ')) {
    zpl = zpl.replace('^XZ', `^PQ${copies}\n^XZ`);
  }

  return zpl;
}

export async function checkBackendStatus(silent: boolean = false): Promise<boolean> {
  updateStatusBadges('checking', 'Backend: Verificando...');
  try {
    const health = await healthCheck();
    const status = health?.status?.toLowerCase();
    isBackendOnline = Boolean(status === 'healthy' || status === 'ok');

    if (isBackendOnline) {
      updateStatusBadges('online', 'Backend: En línea');
      if (!silent) {
        showToast('Servidor Conectado', 'La API REST de LabelPrinterMVP está operativa.', 'success');
      }
      return true;
    } else {
      updateStatusBadges('offline', `Backend: Estado no saludable (${health?.status || 'desconocido'})`);
      if (!silent) {
        showToast('Backend No Saludable', `El servidor respondió con estado: ${health?.status}`, 'error');
      }
      return false;
    }
  } catch (err: any) {
    isBackendOnline = false;
    updateStatusBadges('offline', 'Backend: Desconectado');
    if (!silent) {
      showToast('Backend Desconectado', err.message || 'No se pudo contactar el servidor backend en http://localhost:5000', 'error');
    }
    return false;
  }
}

export async function loadUsbPrinters(silent: boolean = false): Promise<void> {
  const selectUsbPrinter = document.getElementById('select-usb-printer') as HTMLSelectElement;
  const usbPrinterCount = document.getElementById('usb-printer-count');

  if (!selectUsbPrinter) return;
  selectUsbPrinter.innerHTML = '<option value="">Consultando impresoras instaladas...</option>';
  if (usbPrinterCount) usbPrinterCount.textContent = 'Detectando dispositivos...';

  try {
    const res = await getAvailablePrinters();
    usbPrintersList = res.printers || [];

    if (usbPrintersList.length === 0) {
      selectUsbPrinter.innerHTML = '<option value="">No se encontraron impresoras en el sistema</option>';
      if (usbPrinterCount) usbPrinterCount.textContent = ' No hay impresoras detectadas en el servidor Windows.';
      if (!silent) {
        showToast('Sin impresoras', 'No se encontraron impresoras instaladas en el servidor.', 'info');
      }
      return;
    }

    selectUsbPrinter.innerHTML = '';
    const savedPrinter = localStorage.getItem('zpl_selected_usb_printer');

    usbPrintersList.forEach((printer) => {
      const opt = document.createElement('option');
      opt.value = printer;
      opt.textContent = printer;
      if (printer === savedPrinter) {
        opt.selected = true;
      }
      selectUsbPrinter.appendChild(opt);
    });

    if (usbPrinterCount) {
      usbPrinterCount.textContent = ` ${usbPrintersList.length} impresora(s) detectada(s) en Windows.`;
    }
    if (!silent) {
      showToast('Impresoras Actualizadas', `Se encontraron ${usbPrintersList.length} impresoras instaladas.`, 'success');
    }
  } catch (err: any) {
    selectUsbPrinter.innerHTML = '<option value="">Error al listar impresoras</option>';
    if (usbPrinterCount) usbPrinterCount.textContent = ' Error de comunicación con el backend.';
    if (!silent) {
      showToast('Error', err.message || 'No se pudieron listar las impresoras USB/Spooler.', 'error');
    }
  }
}

function switchConnTab(tab: 'conn-usb' | 'conn-tcp' | 'conn-api') {
  currentConnTab = tab;
  localStorage.setItem('zpl_conn_tab', tab);

  const connTabBtns = document.querySelectorAll('.conn-tab-btn');
  const connUsb = document.getElementById('conn-usb');
  const connTcp = document.getElementById('conn-tcp');
  const connApi = document.getElementById('conn-api');

  connTabBtns.forEach((b) => {
    if (b.getAttribute('data-tab') === tab) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  connUsb?.classList.toggle('hidden', tab !== 'conn-usb');
  connTcp?.classList.toggle('hidden', tab !== 'conn-tcp');
  connApi?.classList.toggle('hidden', tab !== 'conn-api');

  if (tab === 'conn-usb' && usbPrintersList.length === 0 && isBackendOnline) {
    loadUsbPrinters(true);
  }
}

function updateStatusBadges(status: 'online' | 'offline' | 'checking', text: string) {
  const headerBadge = document.getElementById('backend-status-badge');
  const headerText = document.getElementById('backend-status-text');
  const modalBadge = document.getElementById('modal-backend-status');
  const modalText = document.getElementById('modal-backend-status-text');

  const applyClass = (el: HTMLElement | null, txtEl: HTMLElement | null) => {
    if (!el || !txtEl) return;
    el.className = `backend-status-badge status-${status}`;
    txtEl.textContent = text;
  };

  applyClass(headerBadge, headerText);
  applyClass(modalBadge, modalText);
}

async function handleSendPrint() {
  const zpl = getActiveZplForPrinting();
  if (!zpl || zpl.trim().length === 0) {
    showToast('Etiqueta Vacía', 'No hay código ZPL para imprimir.', 'error');
    return;
  }

  // Pre-flight check
  if (latestValidationReport && latestValidationReport.hasErrors) {
    const proceed = confirm(`Atención: El código ZPL tiene ${latestValidationReport.errorCount} error(es) de sintaxis que podrían fallar en la impresora.\n\n¿Deseas intentar imprimir de todos modos?`);
    if (!proceed) return;
  }

  setSendButtonLoading(true);

  try {
    if (currentConnTab === 'conn-usb') {
      const selectUsbPrinter = document.getElementById('select-usb-printer') as HTMLSelectElement;
      const printerName = selectUsbPrinter?.value;
      if (!printerName) {
        throw new Error('Por favor selecciona una impresora instalada.');
      }
      const res = await printViaUsb(zpl, printerName);
      addPrintLog(printerName, true, res.message || 'Etiqueta enviada al Spooler de Windows con éxito.');
      showToast('Impresión Enviada', `Trabajo enviado a "${printerName}".`, 'success');
    } else if (currentConnTab === 'conn-tcp') {
      const inputHost = document.getElementById('input-tcp-host') as HTMLInputElement;
      const inputPort = document.getElementById('input-tcp-port') as HTMLInputElement;
      const host = inputHost?.value?.trim() || '127.0.0.1';
      const port = parseInt(inputPort?.value || '9100', 10) || 9100;

      const res = await printViaTcp(zpl, host, port);
      addPrintLog(`${host}:${port}`, true, res.message || 'Bytes TCP transmitidos con éxito.');
      showToast('Impresión TCP Exitosa', `Etiqueta enviada a ${host}:${port}`, 'success');
    } else {
      showToast('Modo API', 'Usa el botón "Generar ZPL desde Backend API" para probar este modo.', 'info');
    }
  } catch (err: any) {
    const target = currentConnTab === 'conn-usb'
      ? (document.getElementById('select-usb-printer') as HTMLSelectElement)?.value || 'USB'
      : (document.getElementById('input-tcp-host') as HTMLInputElement)?.value || 'TCP';
    addPrintLog(target, false, err.message || 'Error desconocido.');
    showToast('Fallo de Impresión', err.message || 'No se pudo enviar la etiqueta a la impresora.', 'error');
  } finally {
    setSendButtonLoading(false);
  }
}

async function handleTestPrint() {
  const zpl = generateTestZpl();
  setSendButtonLoading(true);

  try {
    if (currentConnTab === 'conn-usb') {
      const selectUsbPrinter = document.getElementById('select-usb-printer') as HTMLSelectElement;
      const printerName = selectUsbPrinter?.value;
      if (!printerName) throw new Error('Selecciona una impresora USB primero.');
      const res = await printViaUsb(zpl, printerName);
      addPrintLog(printerName, true, '[PRUEBA] ' + (res.message || 'Etiqueta de prueba impresa.'));
      showToast('Prueba Enviada', `Etiqueta de prueba enviada a "${printerName}".`, 'success');
    } else if (currentConnTab === 'conn-tcp') {
      const inputHost = document.getElementById('input-tcp-host') as HTMLInputElement;
      const inputPort = document.getElementById('input-tcp-port') as HTMLInputElement;
      const host = inputHost?.value?.trim() || '127.0.0.1';
      const port = parseInt(inputPort?.value || '9100', 10) || 9100;

      const res = await printViaTcp(zpl, host, port);
      addPrintLog(`${host}:${port}`, true, '[PRUEBA] ' + (res.message || 'Etiqueta de prueba TCP enviada.'));
      showToast('Prueba TCP Enviada', `Etiqueta de prueba enviada a ${host}:${port}`, 'success');
    }
  } catch (err: any) {
    showToast('Error de Prueba', err.message || 'No se pudo imprimir la prueba.', 'error');
  } finally {
    setSendButtonLoading(false);
  }
}

async function handleGenerateApiZpl() {
  const nameInput = document.getElementById('api-product-name') as HTMLInputElement;
  const skuInput = document.getElementById('api-product-code') as HTMLInputElement;
  const productName = nameInput?.value || 'PRODUCTO ZEBRA PRO';
  const sku = skuInput?.value || 'SKU-123456';

  try {
    const res = await buildZplFromData({ productName, code: sku });
    const modalZplPreview = document.getElementById('modal-zpl-preview') as HTMLTextAreaElement;
    if (res.zpl && modalZplPreview) {
      const manualRadio = document.querySelector('input[name="zpl-source-mode"][value="manual"]') as HTMLInputElement;
      if (manualRadio) manualRadio.checked = true;
      modalZplPreview.value = res.zpl;
      syncModalZpl(true);
      showToast('ZPL Generado', 'ZPL recibido del endpoint /api/zpl/build.', 'success');
    }
  } catch (err: any) {
    showToast('Error de API', err.message || 'No se pudo generar ZPL desde la API.', 'error');
  }
}

function setSendButtonLoading(loading: boolean) {
  const btnSendPrint = document.getElementById('btn-send-print') as HTMLButtonElement;
  const sendSpinner = document.getElementById('send-spinner');
  const sendIcon = document.getElementById('send-icon');
  const sendBtnLabel = document.getElementById('send-btn-label');

  if (btnSendPrint) btnSendPrint.disabled = loading;
  if (sendSpinner) sendSpinner.classList.toggle('hidden', !loading);
  if (sendIcon) sendIcon.classList.toggle('hidden', loading);
  if (sendBtnLabel) sendBtnLabel.textContent = loading ? 'Transmitiendo...' : 'Enviar a Impresora';
}

function addPrintLog(target: string, success: boolean, message: string) {
  const item: PrintLogItem = {
    time: new Date().toLocaleTimeString(),
    target,
    success,
    message
  };
  printLogs.unshift(item);
  if (printLogs.length > 50) printLogs.pop();
  renderPrintLogs();
}

function renderPrintLogs() {
  const printLogsList = document.getElementById('print-logs-list');
  if (!printLogsList) return;

  if (printLogs.length === 0) {
    printLogsList.innerHTML = '<div class="log-item empty-log">No hay registros de impresión en esta sesión.</div>';
    return;
  }

  printLogsList.innerHTML = '';
  printLogs.forEach((log) => {
    const row = document.createElement('div');
    row.className = `log-item ${log.success ? 'log-success' : 'log-error'}`;
    row.innerHTML = `
      <span class="log-time">${log.time}</span>
      <span class="log-target">${log.target}</span>
      <span class="log-status-tag ${log.success ? 'tag-success' : 'tag-error'}">
        ${log.success ? 'OK' : 'FALLO'}
      </span>
      <span class="log-msg" title="${log.message}">${log.message}</span>
    `;
    printLogsList.appendChild(row);
  });
}
