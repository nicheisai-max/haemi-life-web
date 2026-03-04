import { cva } from "class-variance-authority"

export const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow hover:bg-primary/90 dark:shadow-[0_4px_20px_rgba(63,194,181,0.25)] dark:border-none",
                premium:
                    "premium-cta text-white shadow-lg",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                outline:
                    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:hover:bg-primary/10 dark:hover:text-primary dark:border-primary/20 dark:hover:border-primary/40",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-primary/10 dark:hover:text-primary",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-11 px-4 py-2",
                sm: "h-9 rounded-md px-3 text-xs",
                lg: "h-12 rounded-md px-8",
                icon: "h-11 w-11",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)
