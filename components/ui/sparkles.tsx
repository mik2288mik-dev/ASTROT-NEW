"use client";

import React, { useEffect, useId, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import type { Container, ISourceOptions } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { motion, useAnimation } from 'framer-motion';
import { cn } from '../../lib/cn';

type ParticlesProps = {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
};

let particlesInitPromise: Promise<void> | null = null;

function ensureParticlesEngine() {
  if (!particlesInitPromise) {
    particlesInitPromise = initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    });
  }
  return particlesInitPromise;
}

export const SparklesCore = ({
  id,
  className,
  background = 'transparent',
  minSize = 0.4,
  maxSize = 1.2,
  speed = 1.6,
  particleColor = '#ffffff',
  particleDensity = 90,
}: ParticlesProps) => {
  const [init, setInit] = useState(false);
  const controls = useAnimation();
  const generatedId = useId();

  useEffect(() => {
    let mounted = true;
    ensureParticlesEngine().then(() => {
      if (mounted) setInit(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const particlesLoaded = async (container?: Container) => {
    if (!container) return;
    await controls.start({
      opacity: 1,
      transition: { duration: 0.8 },
    });
  };

  const options = useMemo<ISourceOptions>(
    () => ({
      background: {
        color: { value: background },
      },
      fullScreen: {
        enable: false,
        zIndex: 1,
      },
      fpsLimit: 60,
      interactivity: {
        events: {
          onClick: { enable: false },
          onHover: { enable: false },
          resize: { enable: true },
        },
      },
      particles: {
        color: { value: particleColor },
        links: { enable: false },
        move: {
          enable: true,
          direction: 'none',
          outModes: { default: 'out' },
          random: false,
          speed: { min: 0.08, max: speed },
          straight: false,
        },
        number: {
          density: {
            enable: true,
            width: 400,
            height: 400,
          },
          value: particleDensity,
        },
        opacity: {
          value: { min: 0.08, max: 0.82 },
          animation: {
            enable: true,
            speed,
            sync: false,
            startValue: 'random',
          },
        },
        shape: { type: 'circle' },
        size: {
          value: { min: minSize, max: maxSize },
        },
      },
      detectRetina: true,
    }),
    [background, maxSize, minSize, particleColor, particleDensity, speed]
  );

  return (
    <motion.div animate={controls} className={cn('opacity-0', className)}>
      {init ? (
        <Particles
          id={id || generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={options}
        />
      ) : null}
    </motion.div>
  );
};
