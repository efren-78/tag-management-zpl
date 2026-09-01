export interface LabelElement {
  id: string;
  type: 'text' | 'barcode' | 'rect' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 'N' | 'R' | 'I' | 'B';
  content: string;
  // Text specific
  fontSizeH?: number;
  fontSizeW?: number;
  isSequential?: boolean;
  seqStart?: number;
  // Barcode specific
  barcodeType?: '128' | '39' | 'QR';
  barcodeRatio?: number;
  barcodeHeight?: number;
  // Image specific
  imageSrc?: string;
  zplHex?: string;
  zplTotalBytes?: number;
  zplRowBytes?: number;
  zplImgWidth?: number;
  zplImgHeight?: number;
}

export interface ZplMediaConfig {
  mediaTracking: 'gap' | 'web' | 'black_mark' | 'continuous' | 'auto'; // ^MN: MNY, MNW, MNM, MNN, MNA
  mediaType: 'thermal_transfer' | 'direct_thermal';                   // ^MT: MTT, MTD
  printMode: 'tear_off' | 'cutter' | 'peel_off' | 'rewind';           // ^MM: MMT, MMC, MMP, MMR
  printSpeed?: number;                                                // ^PR (2, 3, 4, 6, 8, 10, 12, 14 ips)
  darkness?: number;                                                  // ~SD (0 - 30)
  topOffsetDots?: number;                                             // ^LT (puntos de desplazamiento)
}

export interface ParsedZpl {
  widthInches: number;
  heightInches: number;
  widthDots: number;
  heightDots: number;
  dpi: number;
  elements: LabelElement[];
  mediaConfig: ZplMediaConfig;
}

export interface DynamicBounds {
  topOffsetDots: number;
  leftOffsetDots: number;
  widthDots: number;
  heightDots: number;
  widthInches: number;
  heightInches: number;
}

export interface RenderResult {
  dataUrl: string;
  width: number;
  height: number;
}
