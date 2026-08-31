import type { LabelElement, ParsedZpl, DynamicBounds } from './types';
import { renderZplHexToDataUrlAsync } from './zplImageRenderer';
export type { ParsedZpl, DynamicBounds };

/**
 * Scans ZPL text to detect min/max coordinates and calculate dynamic margins & safe paper bounds.
 */
export function detectZplBounds(
  zplText: string,
  defaultWidthDots: number = 839,
  defaultHeightDots: number = 1678,
  dpi: number = 203
): DynamicBounds {
  let minY = 0;
  let maxY = 0;
  let minX = 0;
  let maxX = 0;

  // Search all ^FO and ^FT coordinates
  const regex = /\^(FO|FT)\s*(-?\d+)\s*,\s*(-?\d+)/g;
  let match;

  while ((match = regex.exec(zplText)) !== null) {
    const x = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);

    if (!isNaN(x)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (!isNaN(y)) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Calculate dynamic top margin needed for safe visual padding (especially for negative Y in ^FT 180° text)
  let topOffsetDots = 15;
  if (minY < 0) {
    topOffsetDots = Math.abs(minY) + 15;
  }

  let targetHeightDots = Math.max(defaultHeightDots, maxY + topOffsetDots + 15);
  let targetWidthDots = Math.max(defaultWidthDots, maxX + 15);

  const widthInches = parseFloat((targetWidthDots / dpi).toFixed(2));
  const heightInches = parseFloat((targetHeightDots / dpi).toFixed(2));

  return {
    topOffsetDots,
    leftOffsetDots: minX < 0 ? Math.abs(minX) + 10 : 0,
    widthDots: targetWidthDots,
    heightDots: targetHeightDots,
    widthInches,
    heightInches
  };
}

/**
 * Parses ZPL/PRN string and returns canvas dimensions and reconstructed elements.
 */
export async function parseZplCode(zplText: string, currentDpi: number = 203): Promise<ParsedZpl> {
  // Default values
  let widthDots: number | null = null;
  let heightDots: number | null = null;
  let dpi = currentDpi;

  // Media Hardware Config defaults
  let mediaTracking: 'gap' | 'black_mark' | 'continuous' | 'auto' = 'gap';
  let mediaType: 'thermal_transfer' | 'direct_thermal' = 'thermal_transfer';
  let printMode: 'tear_off' | 'cutter' | 'peel_off' | 'rewind' = 'tear_off';
  let printSpeed: number | undefined = undefined;
  let darkness: number | undefined = undefined;
  let topOffsetDots: number | undefined = undefined;

  const elements: LabelElement[] = [];

  // Remove whitespace and newlines, keep command delimiters
  const cleanZpl = zplText.replace(/\r?\n/g, '');

  // Split by ^ or ~
  const segments = cleanZpl.split(/[\^~]/);

  let currentX = 0;
  let currentY = 0;
  let currentRotation: 'N' | 'R' | 'I' | 'B' = 'N';
  let currentFontH = 30;
  let currentFontW = 30;
  let currentBarcodeRatio = 2;
  let currentBarcodeHeight = 100;
  
  // Track parser states
  let nextElementType: 'text' | 'barcode' | null = null;
  let nextBarcodeType: '128' | '39' | 'QR' = '128';
  let nextBarcodeHeight = 100;
  let nextBarcodeRot: 'N' | 'R' | 'I' | 'B' = 'N';
  
  let elementCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i].trim();
    if (seg.length < 2) continue;

    const cmd = seg.substring(0, 2);
    const params = seg.substring(2);

    switch (cmd) {
      case 'PW': {
        // Label Width
        const w = parseInt(params, 10);
        if (!isNaN(w) && w > 0) widthDots = w;
        break;
      }
      case 'LL': {
        // Label Length/Height
        const h = parseInt(params, 10);
        if (!isNaN(h) && h > 0) heightDots = h;
        break;
      }
      case 'MN': {
        // Media Tracking: ^MNY (gap), ^MNM (black mark), ^MNN (continuous), ^MNA (auto)
        const type = params.substring(0, 1).toUpperCase();
        if (type === 'N') mediaTracking = 'continuous';
        else if (type === 'M') mediaTracking = 'black_mark';
        else if (type === 'A') mediaTracking = 'auto';
        else mediaTracking = 'gap';
        break;
      }
      case 'MT': {
        // Media Type: ^MTT (thermal transfer / ribbon), ^MTD (direct thermal)
        const type = params.substring(0, 1).toUpperCase();
        if (type === 'D') mediaType = 'direct_thermal';
        else mediaType = 'thermal_transfer';
        break;
      }
      case 'MM': {
        // Print Mode: ^MMT (tear-off), ^MMC (cutter), ^MMP (peel-off), ^MMR (rewind)
        const mode = params.substring(0, 1).toUpperCase();
        if (mode === 'C') printMode = 'cutter';
        else if (mode === 'P') printMode = 'peel_off';
        else if (mode === 'R') printMode = 'rewind';
        else printMode = 'tear_off';
        break;
      }
      case 'PR': {
        // Print Speed: ^PRp,r,b (print, slew, backfeed speed)
        const speed = parseInt(params.split(',')[0], 10);
        if (!isNaN(speed) && speed > 0) printSpeed = speed;
        break;
      }
      case 'SD': {
        // Darkness / Temperatura: ~SDd (0-30)
        const darkVal = parseInt(params, 10);
        if (!isNaN(darkVal)) darkness = darkVal;
        break;
      }
      case 'LT': {
        // Label Top Offset: ^LTt
        const ltVal = parseInt(params, 10);
        if (!isNaN(ltVal)) topOffsetDots = ltVal;
        break;
      }
      case 'FO': {
        // Field Origin: ^FOx,y,z
        const parts = params.split(',');
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        if (!isNaN(x)) currentX = x;
        if (!isNaN(y)) currentY = y;
        break;
      }
      case 'FT': {
        // Field Typeset: ^FTx,y,z (y is baseline, adjust for font height)
        const parts = params.split(',');
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        if (!isNaN(x)) currentX = x;
        if (!isNaN(y)) currentY = Math.max(0, y - currentFontH);
        break;
      }
      case 'BY': {
        // Barcode parameters: ^BYw,r,h
        const parts = params.split(',');
        const ratio = parseInt(parts[0], 10);
        if (!isNaN(ratio)) currentBarcodeRatio = ratio;
        break;
      }
      case 'BC': {
        // Code 128: ^BCo,h,f,g,h
        const parts = params.split(',');
        nextElementType = 'barcode';
        nextBarcodeType = '128';
        if (parts[0] && ['N', 'R', 'I', 'B'].includes(parts[0])) {
          nextBarcodeRot = parts[0] as 'N' | 'R' | 'I' | 'B';
        } else {
          nextBarcodeRot = 'N';
        }
        const h = parseInt(parts[1], 10);
        nextBarcodeHeight = !isNaN(h) ? h : currentBarcodeHeight;
        break;
      }
      case 'B3': {
        // Code 39: ^B3o,e,h,f,g
        const parts = params.split(',');
        nextElementType = 'barcode';
        nextBarcodeType = '39';
        if (parts[0] && ['N', 'R', 'I', 'B'].includes(parts[0])) {
          nextBarcodeRot = parts[0] as 'N' | 'R' | 'I' | 'B';
        } else {
          nextBarcodeRot = 'N';
        }
        const h = parseInt(parts[2], 10);
        nextBarcodeHeight = !isNaN(h) ? h : currentBarcodeHeight;
        break;
      }
      case 'BQ': {
        // QR Code: ^BQo,m,m
        const parts = params.split(',');
        nextElementType = 'barcode';
        nextBarcodeType = 'QR';
        if (parts[0] && ['N', 'R', 'I', 'B'].includes(parts[0])) {
          nextBarcodeRot = parts[0] as 'N' | 'R' | 'I' | 'B';
        } else {
          nextBarcodeRot = 'N';
        }
        break;
      }
      case 'GB': {
        // Graphic Box (Rectangle): ^GBw,h,t,c,r
        const parts = params.split(',');
        const w = parseInt(parts[0], 10) || 50;
        const h = parseInt(parts[1], 10) || 50;
        elementCount++;
        elements.push({
          id: `rect_${elementCount}`,
          type: 'rect',
          x: currentX,
          y: currentY,
          width: w,
          height: h,
          rotation: 'N',
          content: ''
        });
        break;
      }
      case 'GF': {
        // Graphics Field: ^GFA,binaryBytes,totalBytes,rowBytes,hexData
        const commaIndexes: number[] = [];
        let commaCount = 0;
        for (let j = 0; j < params.length; j++) {
          if (params[j] === ',') {
            commaIndexes.push(j);
            commaCount++;
            if (commaCount === 4) break;
          }
        }

        if (commaCount >= 4) {
          const totalBytes = parseInt(params.substring(commaIndexes[1] + 1, commaIndexes[2]), 10);
          const rowBytes = parseInt(params.substring(commaIndexes[2] + 1, commaIndexes[3]), 10);
          const hexData = params.substring(commaIndexes[3] + 1).replace(/FS$/, '').trim();

          const imgWidth = rowBytes * 8;
          const imgHeight = Math.ceil(totalBytes / rowBytes);
          
          const imageSrc = (await renderZplHexToDataUrlAsync(hexData, rowBytes, totalBytes)) || undefined;

          elementCount++;
          elements.push({
            id: `image_${elementCount}`,
            type: 'image',
            x: currentX,
            y: currentY,
            width: imgWidth,
            height: imgHeight,
            rotation: 'N',
            content: '',
            imageSrc: imageSrc,
            zplHex: hexData,
            zplTotalBytes: totalBytes,
            zplRowBytes: rowBytes,
            zplImgWidth: imgWidth,
            zplImgHeight: imgHeight
          });
        }
        break;
      }
      case 'SN': {
        // Sequential data: ^SNvalue,increment,pad
        const parts = params.split(',');
        const val = parseInt(parts[0], 10) || 1;
        elementCount++;
        elements.push({
          id: `text_${elementCount}`,
          type: 'text',
          x: currentX,
          y: currentY,
          width: currentFontW * 10,
          height: currentFontH,
          rotation: currentRotation,
          content: `Serie ${val}`,
          fontSizeH: currentFontH,
          fontSizeW: currentFontW,
          isSequential: true,
          seqStart: val
        });
        nextElementType = null;
        break;
      }
      case 'FD': {
        // Field Data: ^FDcontent
        let content = params.replace(/FS$/, '');

        if (nextElementType === 'barcode') {
          let finalContent = content;
          if (nextBarcodeType === 'QR' && content.startsWith('QA,')) {
            finalContent = content.substring(3);
          }

          elementCount++;
          elements.push({
            id: `barcode_${elementCount}`,
            type: 'barcode',
            x: currentX,
            y: currentY,
            width: nextBarcodeType === 'QR' ? 120 : currentBarcodeRatio * finalContent.length * 12,
            height: nextBarcodeType === 'QR' ? 120 : nextBarcodeHeight + 20,
            rotation: nextBarcodeRot,
            content: finalContent,
            barcodeType: nextBarcodeType,
            barcodeRatio: currentBarcodeRatio,
            barcodeHeight: nextBarcodeHeight
          });
        } else {
          // It's text
          elementCount++;
          const estWidth = Math.round(content.length * (currentFontW * 0.7));
          elements.push({
            id: `text_${elementCount}`,
            type: 'text',
            x: currentX,
            y: currentY,
            width: estWidth,
            height: currentFontH,
            rotation: currentRotation,
            content: content,
            fontSizeH: currentFontH,
            fontSizeW: currentFontW
          });
        }

        nextElementType = null;
        break;
      }
      default: {
        if (cmd.startsWith('A')) {
          const parts = params.split(',');
          const rot = parts[0] ? parts[0].substring(0, 1) : 'N';
          if (['N', 'R', 'I', 'B'].includes(rot)) {
            currentRotation = rot as 'N' | 'R' | 'I' | 'B';
          }
          const h = parseInt(parts[1], 10);
          const w = parseInt(parts[2], 10);
          if (!isNaN(h)) currentFontH = h;
          if (!isNaN(w)) currentFontW = w;
        }
        break;
      }
    }
  }

  // Scan boundary coordinates to ensure no content is clipped
  const bounds = detectZplBounds(zplText, widthDots || 812, heightDots || 609, dpi);

  const finalWidthDots = widthDots ? Math.max(widthDots, bounds.widthDots) : bounds.widthDots;
  const finalHeightDots = heightDots ? Math.max(heightDots, bounds.heightDots) : bounds.heightDots;

  const widthInches = parseFloat((finalWidthDots / dpi).toFixed(2));
  const heightInches = parseFloat((finalHeightDots / dpi).toFixed(2));

  return {
    widthInches,
    heightInches,
    widthDots: finalWidthDots,
    heightDots: finalHeightDots,
    dpi,
    elements,
    mediaConfig: {
      mediaTracking,
      mediaType,
      printMode,
      printSpeed,
      darkness,
      topOffsetDots: topOffsetDots || bounds.topOffsetDots,
    }
  };
}
