import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      <div className="w-12 h-12 rounded-lg bg-surface-2 border border-hairline flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-ink-subtle" />
      </div>
      <h3 className="text-card-title text-ink mb-2">{title}</h3>
      <p className="text-body-sm text-ink-subtle max-w-xs">{description}</p>
      {action && (
        <div className="mt-5">
          {action.href ? (
            <a href={action.href}>
              <Button className="bg-primary hover:bg-primary-hover text-on-primary">
                {action.label}
              </Button>
            </a>
          ) : (
            <Button
              onClick={action.onClick}
              className="bg-primary hover:bg-primary-hover text-on-primary"
            >
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
