'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type ModalPortalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function ModalPortal({ open, onClose, children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className="modal-backdrop animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="modal-center" onClick={onClose} role="presentation">
        {children}
      </div>
    </>,
    document.body,
  );
}
