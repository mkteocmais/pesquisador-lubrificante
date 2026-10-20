import React from "react";

interface BottomTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

// Item da barra inferior do celular: ícone de traço + rótulo. O ativo ganha a
// cor da marca e um tracinho em cima, como nos apps de banco.
export function BottomTab({ active, onClick, icon, label }: BottomTabProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-1 pt-2.5 pb-1 transition-colors ${
 active ? "text-brand-ink" : "text-muted"
      }`}
    >
      {active && <span className="absolute top-0 h-[3px] w-8 rounded-full bg-accent" aria-hidden="true" />}
      {icon}
      <span className={`text-xs ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
    </button>
  );
}
