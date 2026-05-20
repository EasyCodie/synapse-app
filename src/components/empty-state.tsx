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
        "animate-slide-up flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <div className="surface-panel mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/20 bg-primary/8">
        <Icon className="h-5 w-5 text-primary" />
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
