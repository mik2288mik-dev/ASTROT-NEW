import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { monoSlideUp } from './motion';

type MonoShareBarProps = {
  label?: string;
  onShare?: () => void;
  className?: string;
};

export function MonoShareBar({ label = 'Share', onShare, className }: MonoShareBarProps) {
  const reduce = useReducedMotion();

  const bar = (
    <button
      type="button"
      onClick={onShare}
      className="inline-flex min-h-[52px] items-center gap-2 rounded-mono-pill bg-mono-black px-8 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] active:scale-[0.98]"
    >
      <Share2 size={18} strokeWidth={2} />
      {label}
    </button>
  );

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3',
        className,
      )}
    >
      {reduce ? (
        bar
      ) : (
        <motion.div initial="hidden" animate="visible" variants={monoSlideUp}>
          <motion.div whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}>
            {bar}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
