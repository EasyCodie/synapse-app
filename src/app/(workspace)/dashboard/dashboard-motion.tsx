"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";
import { useHasHydrated } from "@/hooks/use-has-hydrated";

interface MotionProps {
  children: ReactNode;
  className?: string;
}

const easeOutQuart = [0.25, 1, 0.5, 1] as [number, number, number, number];

const dashboardVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: easeOutQuart },
  },
};

export function DashboardMotion({ children, className }: MotionProps) {
  const hasHydrated = useHasHydrated();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = hasHydrated && !reduceMotion;

  return (
    <motion.div
      className={className}
      variants={shouldAnimate ? dashboardVariants : undefined}
      initial={shouldAnimate ? "hidden" : false}
      animate={shouldAnimate ? "visible" : undefined}
    >
      {children}
    </motion.div>
  );
}

export function DashboardMotionItem({ children, className }: MotionProps) {
  const hasHydrated = useHasHydrated();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = hasHydrated && !reduceMotion;

  return (
    <motion.div className={className} variants={shouldAnimate ? itemVariants : undefined}>
      {children}
    </motion.div>
  );
}

export function DashboardMotionPanel({ children, className }: MotionProps) {
  const hasHydrated = useHasHydrated();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = hasHydrated && !reduceMotion;

  return (
    <motion.div
      className={className}
      variants={shouldAnimate ? itemVariants : undefined}
      whileHover={shouldAnimate ? { y: -2, transition: { duration: 0.16, ease: easeOutQuart } } : undefined}
    >
      {children}
    </motion.div>
  );
}

export function DashboardMotionRow({ children, className }: MotionProps) {
  const hasHydrated = useHasHydrated();
  const reduceMotion = useReducedMotion();
  const shouldAnimate = hasHydrated && !reduceMotion;

  return (
    <motion.div
      className={className}
      initial={shouldAnimate ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: shouldAnimate ? 0.18 : 0, ease: easeOutQuart }}
    >
      {children}
    </motion.div>
  );
}
