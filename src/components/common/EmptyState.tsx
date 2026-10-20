import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 gap-4">
      <div className="w-16 h-16 flex items-center justify-center rounded-lg bg-brand-soft">
        <Inbox size={28} className="text-brand" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-sm text-ink">{title}</p>
        {description && <p className="text-xs text-muted max-w-[280px] mx-auto leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}
