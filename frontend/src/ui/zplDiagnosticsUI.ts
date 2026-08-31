import { validateZpl, autoFixZpl, type ZplValidationReport, type ZplIssue } from '../zplValidator';
import { showToast } from './toast';

export interface DiagnosticsUICallbacks {
  onZplUpdate: (newZpl: string) => void;
  getCurrentZpl: () => string;
}

export let latestValidationReport: ZplValidationReport | null = null;

let isDrawerOpen = false;
let callbacks: DiagnosticsUICallbacks | null = null;

export function initZplDiagnosticsUI(cb: DiagnosticsUICallbacks) {
  callbacks = cb;

  const btnValidateZpl = document.getElementById('btn-validate-zpl');
  const btnAutofixZpl = document.getElementById('btn-autofix-zpl');
  const btnCopyZpl = document.getElementById('btn-copy-zpl');
  const diagnosticsToggle = document.getElementById('diagnostics-toggle');
  const btnPreflightFix = document.getElementById('btn-preflight-fix');
  const zplOutput = document.getElementById('zpl-output') as HTMLTextAreaElement;

  if (diagnosticsToggle) {
    diagnosticsToggle.addEventListener('click', () => {
      isDrawerOpen = !isDrawerOpen;
      const diagnosticsList = document.getElementById('diagnostics-list');
      const diagnosticsArrow = document.getElementById('diagnostics-arrow');
      if (diagnosticsList && diagnosticsArrow) {
        if (isDrawerOpen) {
          diagnosticsList.classList.add('open');
          diagnosticsArrow.textContent = '▲';
        } else {
          diagnosticsList.classList.remove('open');
          diagnosticsArrow.textContent = '▼';
        }
      }
    });
  }

  if (btnValidateZpl) {
    btnValidateZpl.addEventListener('click', () => {
      if (!callbacks) return;
      const zpl = callbacks.getCurrentZpl();
      const report = runZplValidation(zpl);
      if (report.isValid) {
        showToast('Validación ZPL', 'El código es 100% válido y cumple las reglas.', 'success');
      } else {
        showToast(
          'Diagnóstico ZPL',
          `Se detectaron ${report.errorCount} error(es) y ${report.warningCount} advertencia(s).`,
          report.hasErrors ? 'error' : 'info'
        );
      }
    });
  }

  const handleAutoFix = () => {
    if (!callbacks) return;
    const currentZpl = callbacks.getCurrentZpl();
    const fixResult = autoFixZpl(currentZpl);
    callbacks.onZplUpdate(fixResult.fixedZpl);
    runZplValidation(fixResult.fixedZpl);
    showToast('Auto-corrección Aplicada', 'Se corrigieron automáticamente delimitadores y estructura ZPL.', 'success');
  };

  if (btnAutofixZpl) {
    btnAutofixZpl.addEventListener('click', handleAutoFix);
  }

  if (btnPreflightFix) {
    btnPreflightFix.addEventListener('click', handleAutoFix);
  }

  if (btnCopyZpl && zplOutput) {
    btnCopyZpl.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(zplOutput.value);
        showToast('Copiado', 'Código ZPL copiado al portapapeles.', 'success');
      } catch {
        zplOutput.select();
        document.execCommand('copy');
        showToast('Copiado', 'Código ZPL copiado al portapapeles.', 'success');
      }
    });
  }

  // Real-time typing in textarea
  if (zplOutput) {
    zplOutput.addEventListener('input', () => {
      callbacks?.onZplUpdate(zplOutput.value);
      runZplValidation(zplOutput.value);
    });
  }
}

export function runZplValidation(zplText: string): ZplValidationReport {
  const report = validateZpl(zplText);
  latestValidationReport = report;
  renderDiagnosticsUI(report);
  return report;
}

export function jumpToZplLine(lineNum: number) {
  const textarea = document.getElementById('zpl-output') as HTMLTextAreaElement;
  if (!textarea) return;

  const lines = textarea.value.split('\n');
  let charIndex = 0;
  for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
    charIndex += lines[i].length + 1;
  }

  const targetLineLength = lines[lineNum - 1] ? lines[lineNum - 1].length : 0;
  textarea.focus();
  textarea.setSelectionRange(charIndex, charIndex + targetLineLength);

  const lineHeight = 16;
  textarea.scrollTop = Math.max(0, (lineNum - 3) * lineHeight);
}

function renderDiagnosticsUI(report: ZplValidationReport) {
  const zplSidebarStatusBadge = document.getElementById('zpl-sidebar-status-badge');
  const zplSidebarStatusText = document.getElementById('zpl-sidebar-status-text');
  const diagnosticsCount = document.getElementById('diagnostics-count');
  const diagnosticsList = document.getElementById('diagnostics-list');

  // Modal pre-flight elements
  const printPreflightBanner = document.getElementById('print-preflight-banner');
  const preflightIcon = document.getElementById('preflight-icon');
  const preflightTitle = document.getElementById('preflight-title');
  const preflightDesc = document.getElementById('preflight-desc');
  const btnPreflightFix = document.getElementById('btn-preflight-fix');

  if (!zplSidebarStatusBadge || !zplSidebarStatusText || !diagnosticsList) return;

  // 1. Update Right Sidebar Badge
  zplSidebarStatusBadge.className = 'zpl-val-badge';
  if (report.hasErrors) {
    zplSidebarStatusBadge.classList.add('val-error');
    zplSidebarStatusText.textContent = `${report.errorCount} Error(es) ZPL`;
  } else if (report.hasWarnings) {
    zplSidebarStatusBadge.classList.add('val-warning');
    zplSidebarStatusText.textContent = `${report.warningCount} Advertencia(s)`;
  } else {
    zplSidebarStatusBadge.classList.add('val-valid');
    zplSidebarStatusText.textContent = 'ZPL Válido';
  }

  if (diagnosticsCount) {
    diagnosticsCount.textContent = report.issues.length.toString();
  }

  // 2. Render Diagnostics Drawer list
  diagnosticsList.innerHTML = '';
  if (report.issues.length === 0) {
    const cleanItem = document.createElement('div');
    cleanItem.className = 'diag-item diag-clean';
    cleanItem.innerHTML = '<span>✅ No se detectaron errores de sintaxis en el código ZPL.</span>';
    diagnosticsList.appendChild(cleanItem);
  } else {
    report.issues.forEach((issue: ZplIssue) => {
      const item = document.createElement('div');
      item.className = `diag-item diag-item-${issue.severity}`;

      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';

      item.innerHTML = `
        <div class="diag-item-header">
          <span class="diag-item-icon">${icon}</span>
          <span class="diag-line-tag" title="Hacer clic para saltar a la línea">Línea ${issue.line}</span>
          <span class="diag-item-msg">${issue.message}</span>
        </div>
        ${issue.suggestion ? `<div class="diag-suggestion">💡 ${issue.suggestion}</div>` : ''}
        ${issue.snippet ? `<div class="diag-snippet"><code>${issue.snippet}</code></div>` : ''}
      `;

      const lineTag = item.querySelector('.diag-line-tag');
      if (lineTag) {
        lineTag.addEventListener('click', (e) => {
          e.stopPropagation();
          jumpToZplLine(issue.line);
        });
      }

      diagnosticsList.appendChild(item);
    });
  }

  // 3. Update Pre-flight Banner in Printer Modal
  if (printPreflightBanner && preflightIcon && preflightTitle && preflightDesc) {
    printPreflightBanner.className = 'preflight-banner';
    if (report.hasErrors) {
      printPreflightBanner.classList.add('banner-error');
      preflightIcon.textContent = '🚫';
      preflightTitle.textContent = `Pre-flight ZPL: ${report.errorCount} Error(es) detectado(s)`;
      preflightDesc.textContent = 'El código ZPL contiene problemas estructurales que pueden bloquear o descalibrar la impresora.';
      btnPreflightFix?.classList.remove('hidden');
    } else if (report.hasWarnings) {
      printPreflightBanner.classList.add('banner-warning');
      preflightIcon.textContent = '⚠️';
      preflightTitle.textContent = `Pre-flight ZPL: ${report.warningCount} Advertencia(s)`;
      preflightDesc.textContent = 'Se detectaron elementos fuera de límites o fuentes no estándar. Revisa antes de imprimir.';
      btnPreflightFix?.classList.remove('hidden');
    } else {
      printPreflightBanner.classList.add('banner-valid');
      preflightIcon.textContent = '✅';
      preflightTitle.textContent = 'Pre-flight ZPL: Sintaxis Verificada';
      preflightDesc.textContent = 'La estructura del código es válida y segura para transmitir a la impresora.';
      btnPreflightFix?.classList.add('hidden');
    }
  }
}
