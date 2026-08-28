import { zplToBase64Async } from 'zpl-renderer-js';
import type { RenderResult } from './types';
export type { RenderResult };

/**
 * Render complete ZPL string using zpl-renderer-js WebAssembly renderer.
 */
export async function renderZplWithLibrary(
  zpl: string,
  widthMm: number = 104,
  heightMm: number = 210,
  dpmm: number = 8
): Promise<string> {
  const base64 = await zplToBase64Async(zpl, widthMm, heightMm, dpmm, { grayscaleOutput: true });
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

/**
 * Decodes ZPL hex string (either raw hex or :Z64: compressed) to a data URL using zpl-renderer-js
 */
export async function renderZplHexToDataUrlAsync(
  zplHex: string,
  rowBytes: number,
  totalBytes?: number
): Promise<string | null> {
  try {
    const widthDots = rowBytes * 8;
    const heightDots = totalBytes ? Math.ceil(totalBytes / rowBytes) : 100;
    const tBytes = totalBytes || (rowBytes * heightDots);
    const zplSnippet = `^XA^PW${widthDots}^LL${heightDots}^FO0,0^GFA,${tBytes},${tBytes},${rowBytes},${zplHex}^FS^XZ`;

    const widthMm = widthDots / (203 / 25.4);
    const heightMm = heightDots / (203 / 25.4);

    return await renderZplWithLibrary(zplSnippet, widthMm, heightMm, 8);
  } catch (err) {
    console.error('Error rendering ZPL hex image with zpl-renderer-js:', err);
    return null;
  }
}


/**
 * Obtiene las dimensiones reales en píxeles (naturalWidth y naturalHeight) de una imagen Base64 Data URL.
 */
export function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo cargar la imagen renderizada'));
    img.src = dataUrl;
  });
}

/**
 * Renderiza ZPL → PNG usando zpl-renderer-js (WASM, 100% offline) devolviendo dimensiones reales.
 */
export async function renderZpl(
  zpl: string,
  widthMm: number = 104,
  heightMm: number = 210,
  dpmm: number = 8
): Promise<RenderResult> {
  const dataUrl = await renderZplWithLibrary(zpl, widthMm, heightMm, dpmm);
  const { width, height } = await imageDimensions(dataUrl);
  return { dataUrl, width, height };
}