import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * A bottom sheet on phones and a centered dialog on laptops. Escape or the backdrop closes it.
 * Focus moves to the sheet itself, not a text box, so the phone keyboard never covers the options;
 * it opens only when a box is tapped. A sheet that exists to type in (the talk box) passes focusInput.
 */
export function Sheet({ title, onClose, children, focusInput = false }: { title: string; onClose: () => void; children: ReactNode; focusInput?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const input = focusInput ? ref.current?.querySelector<HTMLElement>('input, textarea') : null;
    (input ?? ref.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  // Rendered at the top of the page so no animated or transformed card can cover or clip it.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h1>{title}</h1>
          <button className="icon-btn" aria-label="Close" data-close onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
