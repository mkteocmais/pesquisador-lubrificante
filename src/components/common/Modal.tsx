import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // Opcional: quando passado, habilita o atalho "Ctrl/Cmd+Enter" pra
  // confirmar o formulário de qualquer campo, sem precisar clicar no botão.
  onSubmit?: () => void;
  // Telas com lista grande (ex: revisão da importação) ficam mais largas no computador.
  wide?: boolean;
}

// No celular o modal abre como "folha" presa embaixo da tela (mais fácil de
// alcançar com o polegar e com o teclado aberto); no computador continua
// centralizado.
export function Modal({ onClose, title, children, onSubmit, wide }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (onSubmit && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    // Trava a rolagem da página de fundo enquanto o modal está aberto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, onSubmit]);

  return (
    <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center md:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#101828]/40 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} />
      <div className={`relative bg-surface w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} rounded-t-xl md:rounded-lg px-6 pt-4 pb-safe md:p-10 overflow-y-auto max-h-[92vh] md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-200`}>
        <div className="w-10 h-1.5 bg-line rounded-full mx-auto mb-3 md:hidden" />
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="p-3 absolute top-3 right-3 md:top-4 md:right-4 text-muted hover:text-slate-800 transition-all"
        >
          <X size={22} />
        </button>
        <h2 className="text-base font-semibold mb-6 md:mb-8 text-ink text-center px-10">{title}</h2>
        {children}
        {onSubmit && (
          <p className="hidden md:block text-center text-xs font-semibold text-slate-300 mt-6">
            Ctrl+Enter salva · Esc cancela
          </p>
        )}
        <div className="h-4 md:hidden" />
      </div>
    </div>
  );
}
