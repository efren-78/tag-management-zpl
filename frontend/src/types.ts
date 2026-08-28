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

export interface ParsedZpl {
  widthInches: number;
  heightInches: number;
  dpi: number;
  elements: LabelElement[];
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
