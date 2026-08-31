/**
 * Motor de Validación y Diagnóstico de Código ZPL (Zebra Programming Language).
 * Analiza estructura, sintaxis de comandos, coordenadas, fuentes, códigos de barras y variables.
 */

export type ZplSeverity = 'error' | 'warning' | 'info';

export type ZplRuleId =
  | 'STRUCT_MISSING_XA'
  | 'STRUCT_MISSING_XZ'
  | 'STRUCT_UNBALANCED_BLOCKS'
  | 'STRUCT_MULTIPLE_LABELS'
  | 'STRUCT_ORPHAN_CONTENT'
  | 'DIM_MISSING_PW'
  | 'DIM_INVALID_PW'
  | 'DIM_MISSING_LL'
  | 'DIM_INVALID_LL'
  | 'FIELD_MISSING_FS'
  | 'FIELD_ORPHAN_FS'
  | 'FIELD_MISSING_ORIGIN'
  | 'COORDS_OUT_OF_BOUNDS'
  | 'COORDS_INVALID'
  | 'FONT_INVALID_ROTATION'
  | 'FONT_INVALID_SIZE'
  | 'BARCODE_INVALID_SYNTAX'
  | 'BARCODE_EMPTY_DATA'
  | 'QR_MISSING_QUALIFIER'
  | 'GB_INVALID_PARAMS'
  | 'UNREPLACED_VARIABLES'
  | 'COPIES_INVALID'
  | 'CHARSET_UNSUPPORTED';

export interface ZplIssue {
  id: ZplRuleId;
  severity: ZplSeverity;
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
  snippet?: string;
}

export interface ZplValidationReport {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ZplIssue[];
  summary: {
    labelCount: number;
    elementCount: number;
    detectedWidthDots?: number;
    detectedHeightDots?: number;
    unreplacedVariables: string[];
  };
}

export interface ValidationOptions {
  labelWidthDots?: number;
  labelHeightDots?: number;
  dpi?: number;
}

/**
 * Realiza una validación exhaustiva de una cadena de código ZPL / PRN.
 */
export function validateZpl(
  zplText: string,
  options: ValidationOptions = {}
): ZplValidationReport {
  const issues: ZplIssue[] = [];
  const lines = zplText.split('\n');

  let xaCount = 0;
  let xzCount = 0;
  let elementCount = 0;
  let detectedWidthDots: number | undefined;
  let detectedHeightDots: number | undefined;
  const unreplacedVariablesSet = new Set<string>();

  const trimmed = zplText.trim();

  // 1. Verificación básica de texto vacío
  if (!trimmed) {
    issues.push({
      id: 'STRUCT_MISSING_XA',
      severity: 'error',
      line: 1,
      message: 'El código ZPL está completamente vacío.',
      suggestion: 'Inicia tu etiqueta con el comando ^XA y termínala con ^XZ.',
    });
    return buildReport(issues, {
      labelCount: 0,
      elementCount: 0,
      unreplacedVariables: [],
    });
  }

  // 2. Análisis línea por línea y seguimiento de estado
  let insideLabel = false;
  let currentFieldOrigin: { line: number; x: number; y: number } | null = null;
  let currentFieldData: { line: number; content: string } | null = null;
  let lastCommandInField: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line || line.startsWith('*')) {
      // Ignorar comentarios
      continue;
    }

    // ── Detección de Bloques ^XA / ^XZ ──
    const xaMatches = line.match(/\^XA/g);
    if (xaMatches) {
      xaCount += xaMatches.length;
      insideLabel = true;
    }

    const xzMatches = line.match(/\^XZ/g);
    if (xzMatches) {
      xzCount += xzMatches.length;
      insideLabel = false;

      // Si se cierra el label y había un ^FD abierto sin ^FS
      if (currentFieldData) {
        issues.push({
          id: 'FIELD_MISSING_FS',
          severity: 'error',
          line: currentFieldData.line,
          message: 'Campo de datos (^FD) sin delimitador de cierre (^FS) antes del fin de etiqueta (^XZ).',
          suggestion: 'Añade ^FS al final del campo de texto/código de barras.',
          snippet: lines[currentFieldData.line - 1],
        });
        currentFieldData = null;
      }
    }

    // Comandos fuera de bloques ^XA...^XZ
    if (!insideLabel && !line.includes('^XA') && !line.includes('^XZ') && (line.startsWith('^') || line.startsWith('~'))) {
      // Algunos comandos de configuración como ~TA, ~SD o CT pueden ir fuera, pero comandos gráficos no
      if (line.includes('^FO') || line.includes('^FD') || line.includes('^GB') || line.includes('^BC')) {
        issues.push({
          id: 'STRUCT_ORPHAN_CONTENT',
          severity: 'warning',
          line: lineNum,
          message: `El comando '${line.substring(0, 15)}...' se encuentra fuera de un bloque ^XA ... ^XZ.`,
          suggestion: 'Envuelve todos los elementos visuales dentro de ^XA y ^XZ.',
          snippet: line,
        });
      }
    }

    // ── Dimensiones: ^PW y ^LL ──
    const pwMatch = line.match(/\^PW\s*(-?\d+)/);
    if (pwMatch) {
      const pw = parseInt(pwMatch[1], 10);
      detectedWidthDots = pw;
      if (isNaN(pw) || pw <= 0) {
        issues.push({
          id: 'DIM_INVALID_PW',
          severity: 'error',
          line: lineNum,
          message: `Ancho de impresión inválido (^PW${pwMatch[1]}). Debe ser un número entero positivo mayor a 0.`,
          suggestion: 'Usa un valor típico como ^PW812 (para 4 pulgadas a 203 DPI).',
          snippet: line,
        });
      } else if (pw > 4000) {
        issues.push({
          id: 'DIM_INVALID_PW',
          severity: 'warning',
          line: lineNum,
          message: `Ancho de impresión inusualmente grande (^PW${pw}). Podría exceder el ancho físico del cabezal térmico.`,
          suggestion: 'Verifica la resolución DPI y el ancho en pulgadas de la etiqueta.',
          snippet: line,
        });
      }
    }

    const llMatch = line.match(/\^LL\s*(-?\d+)/);
    if (llMatch) {
      const ll = parseInt(llMatch[1], 10);
      detectedHeightDots = ll;
      if (isNaN(ll) || ll <= 0) {
        issues.push({
          id: 'DIM_INVALID_LL',
          severity: 'error',
          line: lineNum,
          message: `Largo de etiqueta inválido (^LL${llMatch[1]}). Debe ser mayor a 0.`,
          suggestion: 'Usa un valor como ^LL609 (para 3 pulgadas a 203 DPI).',
          snippet: line,
        });
      }
    }

    // ── Coordenadas: ^FO (Field Origin) y ^FT (Field Typeset) ──
    const foMatches = Array.from(line.matchAll(/\^(FO|FT)\s*(-?\d+)?\s*(?:,\s*(-?\d+)?)?/g));
    for (const match of foMatches) {
      elementCount++;
      const xStr = match[2];
      const yStr = match[3];

      if (xStr === undefined || yStr === undefined) {
        issues.push({
          id: 'COORDS_INVALID',
          severity: 'error',
          line: lineNum,
          message: `Comando ^${match[1]} incompleto. Requiere coordenadas X e Y (^${match[1]}x,y).`,
          suggestion: `Ejemplo: ^${match[1]}50,100`,
          snippet: line,
        });
        continue;
      }

      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);

      currentFieldOrigin = { line: lineNum, x, y };

      // Comprobar coordenadas fuera de límites si se especificaron
      const maxW = detectedWidthDots || options.labelWidthDots;
      const maxH = detectedHeightDots || options.labelHeightDots;

      if (maxW && x > maxW) {
        issues.push({
          id: 'COORDS_OUT_OF_BOUNDS',
          severity: 'warning',
          line: lineNum,
          message: `La coordenada X (${x} dots) excede el ancho declarado de la etiqueta (${maxW} dots).`,
          suggestion: 'El elemento podría quedar cortado o no imprimirse en la etiqueta.',
          snippet: line,
        });
      }

      if (maxH && y > maxH) {
        issues.push({
          id: 'COORDS_OUT_OF_BOUNDS',
          severity: 'warning',
          line: lineNum,
          message: `La coordenada Y (${y} dots) excede el alto declarado de la etiqueta (${maxH} dots).`,
          suggestion: 'El elemento se imprimirá fuera del área visible de la etiqueta.',
          snippet: line,
        });
      }
    }

    // ── Fuentes: ^A o ^A0 ──
    const fontMatches = Array.from(line.matchAll(/\^A([0-9A-Z])([NRIPB])?(?:,\s*(-?\d+))?(?:,\s*(-?\d+))?/g));
    for (const match of fontMatches) {
      const rot = match[2];
      const hStr = match[3];
      const wStr = match[4];

      if (rot && !['N', 'R', 'I', 'B'].includes(rot)) {
        issues.push({
          id: 'FONT_INVALID_ROTATION',
          severity: 'error',
          line: lineNum,
          message: `Orientación de fuente no válida '${rot}'. Las opciones permitidas son N (0°), R (90°), I (180°), B (270°).`,
          suggestion: 'Usa ^A0N,30,30 para orientación normal.',
          snippet: line,
        });
      }

      if (hStr !== undefined) {
        const h = parseInt(hStr, 10);
        if (isNaN(h) || h <= 0) {
          issues.push({
            id: 'FONT_INVALID_SIZE',
            severity: 'error',
            line: lineNum,
            message: `Altura de fuente inválida (${hStr}). Debe ser mayor a 0 dots.`,
            suggestion: 'Usa un tamaño legible como 24 o 30 dots.',
            snippet: line,
          });
        }
      }

      if (wStr !== undefined) {
        const w = parseInt(wStr, 10);
        if (isNaN(w) || w <= 0) {
          issues.push({
            id: 'FONT_INVALID_SIZE',
            severity: 'error',
            line: lineNum,
            message: `Ancho de fuente inválido (${wStr}). Debe ser mayor a 0 dots.`,
            suggestion: 'Usa un ancho legible como 24 o 30 dots.',
            snippet: line,
          });
        }
      }
    }

    // ── Código de Barras: ^BC, ^BQ, ^B3 ──
    if (line.includes('^BC')) {
      lastCommandInField = 'BC';
    } else if (line.includes('^BQ')) {
      lastCommandInField = 'BQ';
    } else if (line.includes('^B3')) {
      lastCommandInField = 'B3';
    }

    // ── Datos de Campo: ^FD ──
    if (line.includes('^FD')) {
      const fdContentMatch = line.match(/\^FD([\s\S]*?)(?:\^FS|$)/);
      const fdContent = fdContentMatch ? fdContentMatch[1] : '';

      currentFieldData = { line: lineNum, content: fdContent };

      // Validar variables sin reemplazar
      const varMatches = Array.from(fdContent.matchAll(/{{\s*([a-zA-Z0-9_-]+)\s*}}/g));
      for (const vm of varMatches) {
        unreplacedVariablesSet.add(vm[1]);
      }

      // Validar QR específico
      if (lastCommandInField === 'BQ') {
        if (!fdContent.startsWith('QA,') && !fdContent.startsWith('LA,') && !fdContent.startsWith('MA,') && !fdContent.startsWith('HA,')) {
          issues.push({
            id: 'QR_MISSING_QUALIFIER',
            severity: 'warning',
            line: lineNum,
            message: 'El código QR (^BQ) no incluye prefijo de corrección de error en ^FD (ej: ^FDQA,datos).',
            suggestion: 'Recomendado usar ^FDQA,tu_contenido^FS para compatibilidad estándar de QR Zebra.',
            snippet: line,
          });
        }
      }

      // Validar si tiene origen de coordenadas previo
      if (!currentFieldOrigin && insideLabel && !line.includes('^FO') && !line.includes('^FT')) {
        issues.push({
          id: 'FIELD_MISSING_ORIGIN',
          severity: 'info',
          line: lineNum,
          message: 'Campo de datos (^FD) sin comando de origen previo (^FO o ^FT). Se ubicará en (0,0).',
          suggestion: 'Añade ^FO50,50 antes de definir el contenido.',
          snippet: line,
        });
      }

      // Si la misma línea tiene ^FS, cerramos el campo
      if (line.includes('^FS')) {
        currentFieldData = null;
        currentFieldOrigin = null;
        lastCommandInField = null;
      }
    }

    // ── Separador de Campo: ^FS ──
    if (line.includes('^FS') && !line.includes('^FD') && !line.includes('^GB')) {
      currentFieldData = null;
      currentFieldOrigin = null;
      lastCommandInField = null;
    }

    // ── Formas Geométricas: ^GB (Graphic Box) ──
    const gbMatch = line.match(/\^GB\s*(-?\d+)?\s*(?:,\s*(-?\d+)?)?(?:,\s*(-?\d+)?)?/);
    if (gbMatch) {
      const w = parseInt(gbMatch[1] || '0', 10);
      const h = parseInt(gbMatch[2] || '0', 10);
      const t = parseInt(gbMatch[3] || '1', 10);

      if (w < 0 || h < 0 || t < 0) {
        issues.push({
          id: 'GB_INVALID_PARAMS',
          severity: 'error',
          line: lineNum,
          message: `Parámetros negativos en caja gráfica ^GB (${gbMatch[0]}).`,
          suggestion: 'El ancho, alto y grosor deben ser valores no negativos.',
          snippet: line,
        });
      }
    }

    // ── Cantidad de Copias: ^PQ ──
    const pqMatch = line.match(/\^PQ\s*(-?\d+)/);
    if (pqMatch) {
      const copies = parseInt(pqMatch[1], 10);
      if (isNaN(copies) || copies <= 0) {
        issues.push({
          id: 'COPIES_INVALID',
          severity: 'error',
          line: lineNum,
          message: `Cantidad de copias inválida (^PQ${pqMatch[1]}). Debe ser 1 o mayor.`,
          suggestion: 'Usa ^PQ1 para imprimir una sola copia.',
          snippet: line,
        });
      }
    }
  }

  // 3. Verificaciones Estructurales Globales
  if (xaCount === 0) {
    issues.unshift({
      id: 'STRUCT_MISSING_XA',
      severity: 'error',
      line: 1,
      message: 'Falta el comando de inicio de etiqueta (^XA). La impresora Zebra ignorará el código.',
      suggestion: 'Agrega ^XA en la primera línea del archivo.',
    });
  }

  if (xzCount === 0) {
    issues.push({
      id: 'STRUCT_MISSING_XZ',
      severity: 'error',
      line: lines.length,
      message: 'Falta el comando de fin de etiqueta (^XZ). La impresora no procesará el trabajo.',
      suggestion: 'Agrega ^XZ en la última línea del archivo.',
    });
  } else if (xaCount !== xzCount) {
    issues.push({
      id: 'STRUCT_UNBALANCED_BLOCKS',
      severity: 'error',
      line: lines.length,
      message: `Bloques desbalanceados: se encontraron ${xaCount} ^XA y ${xzCount} ^XZ.`,
      suggestion: 'Asegúrate de que cada etiqueta abierta con ^XA tenga su respectivo cierre ^XZ.',
    });
  }

  if (xaCount > 1) {
    issues.push({
      id: 'STRUCT_MULTIPLE_LABELS',
      severity: 'info',
      line: 1,
      message: `El archivo contiene ${xaCount} etiquetas independientes en el mismo flujo ZPL.`,
      suggestion: 'Se enviarán múltiples etiquetas en un solo trabajo de impresión.',
    });
  }

  // Advertir sobre variables dinámicas no reemplazadas
  const unreplacedList = Array.from(unreplacedVariablesSet);
  if (unreplacedList.length > 0) {
    issues.push({
      id: 'UNREPLACED_VARIABLES',
      severity: 'warning',
      line: 1,
      message: `Se detectaron ${unreplacedList.length} variables de plantilla sin reemplazar: ${unreplacedList.map((v) => `{{${v}}}`).join(', ')}.`,
      suggestion: 'Si imprimes ahora, el texto literal de las llaves se imprimirá en la etiqueta física.',
    });
  }

  // Verificar si faltan dimensiones declaradas
  if (!detectedWidthDots && options.labelWidthDots) {
    issues.push({
      id: 'DIM_MISSING_PW',
      severity: 'info',
      line: 1,
      message: 'No se declaró ^PW (Print Width). La impresora usará su ancho de papel por defecto.',
      suggestion: `Puedes añadir ^PW${options.labelWidthDots} para asegurar que no se desborde.`,
    });
  }

  return buildReport(issues, {
    labelCount: Math.max(xaCount, 1),
    elementCount,
    detectedWidthDots,
    detectedHeightDots,
    unreplacedVariables: unreplacedList,
  });
}

function buildReport(
  issues: ZplIssue[],
  summary: {
    labelCount: number;
    elementCount: number;
    detectedWidthDots?: number;
    detectedHeightDots?: number;
    unreplacedVariables: string[];
  }
): ZplValidationReport {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    isValid: errorCount === 0,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
    errorCount,
    warningCount,
    infoCount,
    issues,
    summary,
  };
}

/**
 * Corrige automáticamente problemas comunes de sintaxis ZPL:
 * - Agrega ^XA al inicio si falta.
 * - Agrega ^XZ al final si falta.
 * - Cierra comandos ^FD huérfanos con ^FS.
 * - Inyecta ^PW y ^LL si están ausentes y se proveen dimensiones.
 */
export function autoFixZpl(
  zplText: string,
  options: ValidationOptions = {}
): { fixedZpl: string; fixesApplied: string[] } {
  const fixesApplied: string[] = [];
  let zpl = zplText.trim();

  if (!zpl) {
    const pw = options.labelWidthDots || 812;
    const ll = options.labelHeightDots || 609;
    fixesApplied.push('Generada estructura básica ^XA ... ^XZ');
    return {
      fixedZpl: `^XA\n^PW${pw}\n^LL${ll}\n^LH0,0\n^XZ\n`,
      fixesApplied,
    };
  }

  // 1. Agregar ^XA al inicio
  if (!zpl.includes('^XA')) {
    const pw = options.labelWidthDots ? `\n^PW${options.labelWidthDots}` : '';
    const ll = options.labelHeightDots ? `\n^LL${options.labelHeightDots}` : '';
    zpl = `^XA${pw}${ll}\n` + zpl;
    fixesApplied.push('Añadido delimitador de inicio ^XA');
  }

  // 2. Cerrar líneas con ^FD que no tengan ^FS
  const lines = zpl.split('\n');
  let modifiedLines = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('^FD') && !line.includes('^FS') && !line.startsWith('*')) {
      lines[i] = line + '^FS';
      modifiedLines = true;
    }
  }

  if (modifiedLines) {
    zpl = lines.join('\n');
    fixesApplied.push('Cerrados campos ^FD huérfanos con ^FS');
  }

  // 3. Agregar ^XZ al final
  if (!zpl.includes('^XZ')) {
    zpl = zpl + '\n^XZ\n';
    fixesApplied.push('Añadido delimitador de cierre ^XZ');
  }

  // 4. Inyectar ^PW si falta y se conoce el ancho
  if (!zpl.includes('^PW') && options.labelWidthDots) {
    zpl = zpl.replace('^XA', `^XA\n^PW${options.labelWidthDots}`);
    fixesApplied.push(`Inyectado comando de ancho ^PW${options.labelWidthDots}`);
  }

  return {
    fixedZpl: zpl,
    fixesApplied,
  };
}
