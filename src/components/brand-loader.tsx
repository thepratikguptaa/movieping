"use client";

import { motion } from "framer-motion";

/**
 * Branded loading indicator: the MoviePing app icon gently "beats" while a
 * brand-red ring pings outward from behind it. Used for full-screen auth/route
 * loading states in place of a generic spinner.
 */
export function BrandLoader({ size = 56 }: { size?: number }) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      {/* Radiating "ping" ring */}
      <motion.span
        className="absolute inset-0 rounded-[26%] bg-primary/25"
        animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
      />
      {/* Beating app icon */}
      <motion.img
        src="/icon.svg"
        alt=""
        width={size}
        height={size}
        className="relative drop-shadow-[0_0_12px_rgba(229,9,20,0.35)]"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
