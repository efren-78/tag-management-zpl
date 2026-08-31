/**
 * Servicio HTTP para comunicarse con el backend API REST de LabelPrinterMVP.
 * Centraliza todas las llamadas al backend en un solo módulo.
 */

const API_BASE = 'http://localhost:5000/api';

// ── Tipos ──

export interface PrintResponse {
  success: boolean;
  message: string | null;
  zpl?: string | null;
}

export interface BuildLabelRequest {
  productName: string;
  code: string;
  copies?: number;
  widthInches?: number;
  heightInches?: number;
}

// ── Helpers ──

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();

  if (!response.ok && !data) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }

  return data as T;
}

// ── API Methods ──

/**
 * Verifica que el backend esté disponible.
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  return apiRequest('/health');
}

/**
 * Obtiene la lista de impresoras USB/Spooler instaladas en el servidor.
 */
export async function getAvailablePrinters(): Promise<{ printers: string[]; count: number }> {
  return apiRequest('/printers');
}

/**
 * Envía código ZPL a una impresora por TCP/IP (Red Ethernet/Wi-Fi).
 */
export async function printViaTcp(zpl: string, host: string, port: number = 9100): Promise<PrintResponse> {
  return apiRequest('/print/tcp', {
    method: 'POST',
    body: JSON.stringify({ zpl, host, port }),
  });
}

/**
 * Envía código ZPL a una impresora USB conectada al equipo Windows.
 */
export async function printViaUsb(zpl: string, printerName: string): Promise<PrintResponse> {
  return apiRequest('/print/usb', {
    method: 'POST',
    body: JSON.stringify({ zpl, printerName }),
  });
}

/**
 * Genera código ZPL a partir de los datos de una etiqueta.
 */
export async function buildZplFromData(data: BuildLabelRequest): Promise<PrintResponse> {
  return apiRequest('/zpl/build', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
