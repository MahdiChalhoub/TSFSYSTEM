/**
 * Modern Variant Card Component (Based on Your Preferred Theme)
 * =============================================================
 * Purple accent (#9b87f5), SF Pro Display font, soft shadows
 * This matches the design you liked!
 * 
 * Usage:
 *   <Card variant="modern">Your content</Card>
 */
import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardModernProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean
}

export const CardModern = React.forwardRef<HTMLDivElement, CardModernProps>(
  ({ className, children, isActive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Base card style (matches your theme)
        "rounded-[var(--layout-card-radius)]",
        "border border-gray-200 dark:border-gray-800",
        "bg-white dark:bg-card",
        "text-card-foreground",
        "shadow-sm",
        "overflow-hidden",
        
        // Layout
        "p-5",
        
        // Animation
        "transition-all duration-200",
        
        // Active state (purple ring)
        isActive && "ring-2 ring-primary ring-[#9b87f5]",
        
        // Hover effect
        "hover:shadow-md",
        
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
CardModern.displayName = "CardModern"

export const CardModernHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-3 pb-4", className)}
      {...props}
    />
  )
)
CardModernHeader.displayName = "CardModernHeader"

export const CardModernTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        // Typography from your theme
        "text-lg md:text-xl font-semibold",
        "leading-none",
        className
      )}
      {...props}
    />
  )
)
CardModernTitle.displayName = "CardModernTitle"

export const CardModernDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        // Secondary text from your theme
        "text-sm text-muted-foreground",
        "text-[#8E9196]",
        className
      )}
      {...props}
    />
  )
)
CardModernDescription.displayName = "CardModernDescription"

export const CardModernContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn("space-y-3", className)} 
      {...props} 
    />
  )
)
CardModernContent.displayName = "CardModernContent"

export const CardModernFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-between pt-4", className)}
      {...props}
    />
  )
)
CardModernFooter.displayName = "CardModernFooter"
