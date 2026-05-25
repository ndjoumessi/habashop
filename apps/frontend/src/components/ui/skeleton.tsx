import { cn } from "@/lib/utils"

interface SkeletonProps extends Omit<React.ComponentProps<"div">, "height" | "width"> {
  height?: number | string
  width?: number | string
  count?: number
  radius?: number
}

/**
 * Squelette de chargement (shimmer). Rend `count` barres visibles via la classe
 * `.skeleton` (var(--bg4)/var(--bg5)). Usage : <Skeleton height={56} count={5} />
 * ou, façon shadcn, <Skeleton className="h-4 w-20" />.
 */
export function Skeleton({ height = 56, width = "100%", count = 1, radius = 10, className, style, ...props }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-slot="skeleton"
          className={cn("skeleton", className)}
          style={{
            height,
            width,
            borderRadius: radius,
            marginBottom: count > 1 && i < count - 1 ? 8 : undefined,
            ...style,
          }}
          {...props}
        />
      ))}
    </>
  )
}

export default Skeleton
