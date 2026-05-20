import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "interactive-control group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-pill border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap focus-visible:border-primary-focus focus-visible:ring-[3px] focus-visible:ring-primary/30 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary [a]:hover:bg-primary-hover",
        secondary:
          "border-hairline bg-surface-2 text-ink-subtle [a]:hover:bg-surface-3 [a]:hover:text-ink",
        destructive:
          "border-semantic-danger/25 bg-semantic-danger/10 text-semantic-danger focus-visible:ring-semantic-danger/20 [a]:hover:bg-semantic-danger/15",
        outline:
          "border-hairline text-ink-subtle [a]:hover:bg-surface-2 [a]:hover:text-ink",
        ghost:
          "text-ink-subtle hover:bg-surface-2/70 hover:text-ink",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
