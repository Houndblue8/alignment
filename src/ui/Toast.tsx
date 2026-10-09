import { useApp } from '../state/store';

export function ToastView() {
  const toast = useApp((a) => a.toast);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`} role={toast.kind === 'error' ? 'alert' : 'status'} data-testid="toast">
      {toast.text}
    </div>
  );
}
