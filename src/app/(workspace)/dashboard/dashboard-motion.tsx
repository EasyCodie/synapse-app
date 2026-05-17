"use client";

import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ReactNode } from "react";

interface MotionProps {
  children: ReactNode;
  className?: string;
}

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
    transition: { type: "spring", stiffness: 260, damping: 28 },
  },
};

export function DashboardMotion({ children, className }: MotionProps) {
  return (
    <motion.div
      className={className}
      variants={dashboardVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function DashboardMotionItem({ children, className }: MotionProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

export function DashboardMotionPanel({ children, className }: MotionProps) {
  return (
    <motion.div
      className={className}
      variants={itemVariants}
      whileHover={{ y: -2, transition: { duration: 0.16 } }}
    >
      {children}
    </motion.div>
  );
}

export function DashboardMotionRow({ children, className }: MotionProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}
