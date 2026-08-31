import type { LabelElement, ZplMediaConfig } from './types';
export type { LabelElement, ZplMediaConfig };

/**
 * Generates ZPL code from elements list and optional media hardware configuration.
 * @param elements List of label elements.
 * @param widthInches Label width in inches.
 * @param heightInches Label height in inches.
 * @param dpi Dots Per Inch (203, 300, 600).
 * @param variables Optional test values to replace {{variable}} in preview.
 * @param mediaConfig Optional hardware and paper configuration (^MN, ^MT, ^MM, ^PR, ~SD).
 */
export function generateZplCode(
  elements: LabelElement[],
  widthInches: number,
  heightInches: number,
  dpi: number,
  variables: Record<string, string> = {},
  mediaConfig?: Partial<ZplMediaConfig>
): string {
  const widthDots = Math.round(widthInches * dpi);
  const heightDots = Math.round(heightInches * dpi);

  let zpl = '';
  
  // Zebra Initialization commands
  zpl += '^XA\n';
  zpl += `^PW${widthDots}\n`;
  zpl += `^LL${heightDots}\n`;
  zpl += '^LH0,0\n'; // Label Home: top-left
  zpl += `^LT${mediaConfig?.topOffsetDots !== undefined ? mediaConfig.topOffsetDots : 15}\n`;

  // Media tracking ^MN
  if (mediaConfig?.mediaTracking === 'continuous') {
    zpl += '^MNN\n';
  } else if (mediaConfig?.mediaTracking === 'black_mark') {
    zpl += '^MNM\n';
  } else if (mediaConfig?.mediaTracking === 'auto') {
    zpl += '^MNA\n';
  } else if (mediaConfig?.mediaTracking === 'gap') {
    zpl += '^MNY\n';
  }

  // Media type ^MT
  if (mediaConfig?.mediaType === 'direct_thermal') {
    zpl += '^MTD\n';
  } else if (mediaConfig?.mediaType === 'thermal_transfer') {
    zpl += '^MTT\n';
  }

  // Print mode ^MM
  if (mediaConfig?.printMode === 'cutter') {
    zpl += '^MMC\n';
  } else if (mediaConfig?.printMode === 'peel_off') {
    zpl += '^MMP\n';
  } else if (mediaConfig?.printMode === 'rewind') {
    zpl += '^MMR\n';
  } else if (mediaConfig?.printMode === 'tear_off') {
    zpl += '^MMT\n';
  }

  // Print speed ^PR
  if (mediaConfig?.printSpeed) {
    zpl += `^PR${mediaConfig.printSpeed},${mediaConfig.printSpeed}\n`;
  } else {
    zpl += '^PR4,4\n';
  }

  // Darkness ~SD
  if (mediaConfig?.darkness !== undefined) {
    zpl += `~SD${mediaConfig.darkness}\n`;
  }

  zpl += '^CI27\n';  // Code page 27 (Latin 1/UTF-8 compatible)
  zpl += '^PA0,1,1,0\n';
  zpl += '\n';

  elements.forEach((el) => {
    zpl += `* Element: ${el.id} (${el.type})\n`;

    // Perform variable replacement if test values are provided
    let finalContent = el.content;
    if (variables) {
      Object.entries(variables).forEach(([key, val]) => {
        finalContent = finalContent.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), val);
      });
    }

    // Escape character controls ^ and ~ in user content
    const escapedContent = finalContent.replace(/\^/g, '').replace(/~/g, '');

    switch (el.type) {
      case 'text': {
        const fh = el.fontSizeH || 30;
        const fw = el.fontSizeW || 30;
        zpl += `^FO${el.x},${el.y}\n`;
        zpl += `^A0${el.rotation},${fh},${fw}\n`;
        
        if (el.isSequential) {
          const start = el.seqStart !== undefined ? el.seqStart : 1;
          // ^SNvalue,increment,addLeadingZeros
          zpl += `^FD${escapedContent || start}^FS^SN${start},1,Y^FS\n`;
        } else {
          zpl += `^FD${escapedContent}^FS\n`;
        }
        break;
      }
      case 'barcode': {
        const ratio = el.barcodeRatio || 2;
        const h = el.barcodeHeight || 100;
        zpl += `^FO${el.x},${el.y}\n`;
        zpl += `^BY${ratio}\n`;

        if (el.barcodeType === 'QR') {
          // ^BQorientation,model,magnification
          // magnification defaults to 4, orientation standard N
          zpl += `^BQ${el.rotation},2,8\n`;
          // QR requires code input flag. FDQA represents normal mode
          zpl += `^FDQA,${escapedContent}^FS\n`;
        } else if (el.barcodeType === '39') {
          // ^B3orientation,checkDigit,height,printInterpretationLine,printInterpretationLineAbove
          zpl += `^B3${el.rotation},N,${h},Y,N\n`;
          zpl += `^FD${escapedContent}^FS\n`;
        } else {
          // Default Code 128
          // ^BCorientation,height,printInterpretationLine,printInterpretationLineAbove,checkDigit
          zpl += `^BC${el.rotation},${h},Y,N,N\n`;
          zpl += `^FD${escapedContent}^FS\n`;
        }
        break;
      }
      case 'rect': {
        zpl += `^FO${el.x},${el.y}\n`;
        zpl += `^GB${el.width},${el.height},4^FS\n`;
        break;
      }
      case 'image': {
        if (el.zplHex && el.zplTotalBytes && el.zplRowBytes) {
          zpl += `^FO${el.x},${el.y}\n`;
          zpl += `^GFA,${el.zplTotalBytes},${el.zplTotalBytes},${el.zplRowBytes},${el.zplHex}^FS\n`;
        } else {
          zpl += `* [Warning: Missing image data for ${el.id}]\n`;
        }
        break;
      }
    }
    zpl += '\n';
  });

  // End label
  zpl += '^XZ\n';

  return zpl;
}

/**
 * Extracts list of variables used in elements, e.g. {{product_name}}
 */
export function extractVariables(elements: LabelElement[]): string[] {
  const vars = new Set<string>();
  elements.forEach((el) => {
    if (el.type === 'text' || el.type === 'barcode') {
      const matches = el.content.matchAll(/{{\s*([a-zA-Z0-9_-]+)\s*}}/g);
      for (const match of matches) {
        vars.add(match[1]);
      }
    }
  });
  return Array.from(vars);
}
