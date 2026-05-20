"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useHasHydrated } from "@/hooks/use-has-hydrated";

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

const easeOutQuart = [0.25, 1, 0.5, 1] as [number, number, number, number];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easeOutQuart } },
};

export function AnimatedList({ children, className }: AnimatedListProps) {
  const hasHydrated = useHasHydrated();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = hasHydrated && !reduceMotion;

  return (
    <motion.div
      variants={shouldAnimate ? containerVariants : undefined}
      initial={shouldAnimate ? "hidden" : false}
      animate={shouldAnimate ? "visible" : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const hasHydrated = useHasHydrated();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = hasHydrated && !reduceMotion;

  return (
    <motion.div variants={shouldAnimate ? itemVariants : undefined} className={className}>
      {children}
    </motion.div>
  );
}
