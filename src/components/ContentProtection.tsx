import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

function isAllowedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-allow-copy="true"]')) {
    return true;
  }
  return false;
}

export const ContentProtection: React.FC = () => {
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const flashNotice = () => {
      setNotice(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setNotice(false), 2200);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isAllowedTarget(e.target)) return;
      if (e.target instanceof Element && e.target.closest('img, .qamar-protected-surface, main')) {
        e.preventDefault();
        flashNotice();
      }
    };

    const onDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) {
        e.preventDefault();
      }
    };

    const onCopyOrCut = (e: ClipboardEvent) => {
      if (isAllowedTarget(e.target)) return;
      const selected = window.getSelection?.()?.toString?.() || '';
      // Allow short order tracking codes (e.g. QMR-...) while blocking bulk catalog/description copying
      if (/^#?QMR-[A-Z0-9-]+$/i.test(selected.trim())) return;
      if (selected.trim().length > 24 || (e.target instanceof Element && e.target.closest('.qamar-no-copy'))) {
        e.preventDefault();
        flashNotice();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const blockedDevTools =
        e.key === 'F12' ||
        (mod && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (mod && ['u', 's'].includes(key));
      if (blockedDevTools && !isAllowedTarget(e.target)) {
        e.preventDefault();
        flashNotice();
      }
    };

    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('copy', onCopyOrCut, true);
    document.addEventListener('cut', onCopyOrCut, true);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('copy', onCopyOrCut, true);
      document.removeEventListener('cut', onCopyOrCut, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  if (!notice) return null;

  return (
    <div
      role="status"
      data-testid="content-protection-notice"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#252a31]/95 text-white text-xs font-bold shadow-xl border border-[#fe9931]/50 flex items-center gap-2 pointer-events-none qamar-fade-in"
    >
      <ShieldAlert className="w-4 h-4 text-[#fe9931] shrink-0" />
      <span>محتوى وصور قمر للعطور محمية ضد النسخ والسكرابينج</span>
    </div>
  );
};
