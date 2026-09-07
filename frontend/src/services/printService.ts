/**
 * Servicio HTTP para comunicarse con el backend API REST de LabelPrinterMVP.
 * Centraliza todas las llamadas al backend en un solo módulo.
 */

export let API_BASE = 'http://localhost:5000/api';
export let API_KEY = 'zpl-printer-secret-key-2026';

export function setApiBase(url: string) {
  API_BASE = url.replace(/\/+$/, '');
}

export function setApiKey(key: string) {
  API_KEY = key;
}

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

export interface PrintersResponse {
  printers: string[];
  count: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

// ── Helpers ──

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-Api-Key': API_KEY } : {}),
      ...((options?.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // response might not be JSON
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.title || `Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('No se pudo conectar con el servidor backend (http://localhost:5000). Asegúrate de que la API esté en ejecución.');
    }
    throw err;
  }
}

// ── API Methods ──

/**
 * Verifica que el backend esté disponible.
 */
export async function healthCheck(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health');
}

/**
 * Obtiene la lista de impresoras USB/Spooler instaladas en el servidor Windows.
 */
export async function getAvailablePrinters(): Promise<PrintersResponse> {
  return apiRequest<PrintersResponse>('/printers');
}

/**
 * Envía código ZPL a una impresora por TCP/IP (Red Ethernet/Wi-Fi).
 */
export async function printViaTcp(zpl: string, host: string, port: number = 9100): Promise<PrintResponse> {
  return apiRequest<PrintResponse>('/print/tcp', {
    method: 'POST',
    body: JSON.stringify({ zpl, host, port }),
  });
}

/**
 * Envía código ZPL a una impresora USB conectada al equipo Windows.
 */
export async function printViaUsb(zpl: string, printerName: string): Promise<PrintResponse> {
  return apiRequest<PrintResponse>('/print/usb', {
    method: 'POST',
    body: JSON.stringify({ zpl, printerName }),
  });
}

/**
 * Genera código ZPL a partir de los datos de una etiqueta.
 */
export async function buildZplFromData(data: BuildLabelRequest): Promise<PrintResponse> {
  return apiRequest<PrintResponse>('/zpl/build', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Genera un comando ZPL de prueba básico para calibración y test de impresión.
 */
export function generateTestZpl(copies: number = 1): string {
  return `^XA
^PW600
^LL400
^FO50,40^GB500,320,4^FS
^FO80,70^A0N,36,36^FDTEST PRINT / PRUEBA DE IMPRESION^FS
^FO80,120^A0N,24,24^FDZebra ZPL Designer & Backend MVP^FS
^FO80,160^BY2,3,60^BCN,60,Y,N,N^FDTEST-12345^FS
^FO80,260^A0N,22,22^FDFecha: ${new Date().toLocaleString()}^FS
^FO80,290^A0N,20,20^FDEstado: Conexion Exitosa OK^FS
^PQ${Math.max(1, copies)}
^XZ`;
}

