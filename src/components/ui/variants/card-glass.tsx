/**
 * Glass Variant Card Component
 * =============================
 * Beautiful frosted glass effect with backdrop blur
 * Perfect for modern, premium interfaces
 * 
 * Usage:
 *   <Card variant="glass">Your content</Card>
 */
import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardGlassProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardGlass = React.forwardRef<HTMLDivElement, CardGlassProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Glass morphism effect
        "rounded-2xl",
        "bg-white/5",                           // Translucent background
        "backdrop-blur-xl",                     // Frosted glass blur
        "backdrop-saturate-150",                // Enhanced saturation
        "border border-white/10",               // Subtle border
        "shadow-2xl shadow-black/20",           // Soft shadow
        
        // Layout
        "p-[var(--layout-container-padding)]",
        
        // Animation
        "transition-all duration-300",
        "hover:bg-white/10",
        "hover:border-white/20",
        "hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)]",
        
        // Glass shine effect (optional gradient overlay)
        "relative overflow-hidden",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-transparent",
        "before:pointer-events-none",
        
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
CardGlass.displayName = "CardGlass"

export const CardGlassHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 pb-4", className)}
      {...props}
    />
  )
)
CardGlassHeader.displayName = "CardGlassHeader"

export const CardGlassTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        "text-white/90",
        className
      )}
      {...props}
    />
  )
)
CardGlassTitle.displayName = "CardGlassTitle"

export const CardGlassDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-white/60", className)}
      {...props}
    />
  )
)
CardGlassDescription.displayName = "CardGlassDescription"

export const CardGlassContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("pt-0", className)} {...props} />
  )
)
CardGlassContent.displayName = "CardGlassContent"

export const CardGlassFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center pt-4", className)}
      {...props}
    />
  )
)
CardGlassFooter.displayName = "CardGlassFooter"
