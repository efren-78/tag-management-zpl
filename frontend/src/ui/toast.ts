/**
 * Toast Notifications Manager
 */
export function showToast(
  title: string,
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  duration: number = 4000
) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const iconMap: Record<string, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button type="button" class="toast-close" title="Cerrar">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close') as HTMLButtonElement;
  let timer: any = null;

  const removeToast = () => {
    if (timer) clearTimeout(timer);
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', removeToast);
  }

  container.appendChild(toast);

  if (duration > 0) {
    timer = setTimeout(removeToast, duration);
  }
}
