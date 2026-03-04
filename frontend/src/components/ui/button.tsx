import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { PremiumLoader } from "./premium-loader"
import { cn } from "@/lib/utils"
import { buttonVariants } from "./button-variants"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {isLoading && (
              <PremiumLoader
                size="xs"
                className="mr-2"
                bubbleClassName={variant === 'outline' || variant === 'ghost' ? 'bg-primary' : 'bg-primary-foreground'}
              />
            )}
            {!isLoading ? children : "Processing..."}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button }
