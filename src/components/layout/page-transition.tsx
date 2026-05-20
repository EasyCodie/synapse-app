"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useHasHydrated } from "@/hooks/use-has-hydrated";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const easeOutQuart = [0.25, 1, 0.5, 1] as [number, number, number, number];

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const hasHydrated = useHasHydrated();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = hasHydrated && !reduceMotion;

  return (
    <motion.div
      key={pathname}
      initial={shouldAnimate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldAnimate ? 0.18 : 0,
        ease: easeOutQuart,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
