import type { LabelElement, ZplMediaConfig } from './types';

export interface AppState {
  elements: LabelElement[];
  selectedElementId: string | null;
  widthInches: number;
  heightInches: number;
  dpi: number;
  zoom: number;
  testVariables: Record<string, string>;
  loadedRawZpl: string | null;
  mediaConfig: ZplMediaConfig;
}

export const state: AppState = {
  elements: [
    {
      id: 'text_product',
      type: 'text',
      x: 50,
      y: 50,
      width: 300,
      height: 40,
      rotation: 'N',
      content: 'PRODUCTO: {{nombre_producto}}',
      fontSizeH: 40,
      fontSizeW: 40
    },
    {
      id: 'text_serial',
      type: 'text',
      x: 50,
      y: 110,
      width: 200,
      height: 25,
      rotation: 'N',
      content: 'S/N: {{num_serie}}',
      fontSizeH: 25,
      fontSizeW: 25
    },
    {
      id: 'barcode_main',
      type: 'barcode',
      x: 50,
      y: 160,
      width: 300,
      height: 80,
      rotation: 'N',
      content: '{{codigo}}',
      barcodeType: '128',
      barcodeRatio: 2,
      barcodeHeight: 80
    },
    {
      id: 'rect_box',
      type: 'rect',
      x: 30,
      y: 30,
      width: 750,
      height: 540,
      rotation: 'N',
      content: ''
    }
  ],
  selectedElementId: null,
  widthInches: 4,
  heightInches: 3,
  dpi: 203,
  zoom: 1.0,
  testVariables: {
    nombre_producto: 'VÁLVULA DE PRESIÓN 3/4',
    num_serie: '002345',
    codigo: '987654321'
  },
  loadedRawZpl: null,
  mediaConfig: {
    mediaTracking: 'gap',
    mediaType: 'thermal_transfer',
    printMode: 'tear_off',
    printSpeed: 4,
    darkness: 23,
    topOffsetDots: 15,
  }
};

type StateChangeSubscriber = (state: AppState) => void;
const subscribers: StateChangeSubscriber[] = [];

export function subscribeStateChange(cb: StateChangeSubscriber): () => void {
  subscribers.push(cb);
  return () => {
    const index = subscribers.indexOf(cb);
    if (index > -1) subscribers.splice(index, 1);
  };
}

export function notifyStateChange() {
  for (const subscriber of subscribers) {
    subscriber(state);
  }
}
