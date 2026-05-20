'use client';

import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glossy-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
