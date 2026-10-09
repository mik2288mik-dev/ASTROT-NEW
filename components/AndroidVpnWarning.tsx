import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './AndroidVpnWarning.module.css';

export function AndroidVpnWarning({ open, onClose }: {
  open: boolean;
  onClose(): void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => setPortalReady(true), []);
  if (!portalReady || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {open ? (
          <motion.div className={styles.notice}
            initial={reduceMotion ? false : { y: '-110%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: -12, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.25, 1, 0.5, 1] }}>
            <div>
              <p className={styles.title}>Включён VPN</p>
              <p className={styles.text}>Если NEBO долго загружается, попробуй отключить VPN.</p>
            </div>
            <button type="button" className={styles.dismiss} onClick={onClose}>Понятно</button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
