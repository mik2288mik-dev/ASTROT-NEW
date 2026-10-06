import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * A wooden artist's mannequin. Free mode: drag an elbow, a hand, a knee, a foot or the head and the figure takes almost
 * any pose. Guided mode: it shows a relaxation step on its own (fists, shrug, screwed-up face, tight belly, pressed
 * knees, curled toes), with the camera moving in on the part in question.
 */

export type MannequinPart =
  | 'head' | 'chest' | 'belly' | 'shoulderL' | 'shoulderR' | 'handL' | 'handR' | 'thighL' | 'thighR' | 'footL' | 'footR';

type Angles = { armL: number; foreL: number; armR: number; foreR: number; legL: number; shinL: number; legR: number; shinR: number; head: number };
type Look = Angles & { shrug: number; fingers: number; toesShown: number; fist: number; squeeze: number; belly: number; toes: number; zoom: number; fx: number; fy: number };

/** Angles are in degrees from «straight down» (0); positive swings the limb to the right of the screen. */
const REST: Angles = { armL: -14, foreL: -6, armR: 14, foreR: 6, legL: -5, shinL: -3, legR: 5, shinR: 3, head: 0 };
const REST_LOOK: Look = { ...REST, shrug: 0, fingers: 0, toesShown: 0, fist: 0, squeeze: 0, belly: 0, toes: 0, zoom: 1, fx: 130, fy: 186 };

const NECK = { x: 130, y: 72 };
const SHOULDER = { l: { x: 96, y: 92 }, r: { x: 164, y: 92 } };
const HIP = { l: { x: 114, y: 206 }, r: { x: 146, y: 206 } };
const ARM = 54;
const FORE = 50;
const THIGH = 68;
const SHIN = 66;
const VIEW = { x: -55, y: 0, w: 370, h: 372 };

type Point = { x: number; y: number };
const rad = (deg: number) => (deg * Math.PI) / 180;
const toward = (from: Point, deg: number, length: number): Point => ({ x: from.x + Math.sin(rad(deg)) * length, y: from.y + Math.cos(rad(deg)) * length });
const angleTo = (from: Point, to: Point) => (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
const mixValue = (a: number, b: number, t: number) => a + (b - a) * t;

type Handle = keyof Angles;
export type GuideStep = 0 | 1 | 2 | 3 | 4 | 5;

type WoodenMannequinProps = {
  /** Parts shown in a colour while a relaxation step runs. */
  tint?: { parts: readonly MannequinPart[]; state: 'tense' | 'release' | 'idle' } | null;
  /** When set, the figure performs this step by itself and cannot be dragged. */
  guide?: { step: GuideStep; state: 'tense' | 'release' | 'idle' } | null;
  interactive?: boolean;
  className?: string;
  label?: string;
};

/** What the figure looks like for a step in its tense / released state. */
function guidedLook(step: GuideStep, state: 'tense' | 'release' | 'idle'): Look {
  const t = state === 'tense' ? 1 : 0;
  const look: Look = { ...REST_LOOK };
  if (state === 'idle') return look;
  switch (step) {
    case 0: // fists: forearms raised so the hands can be seen
      Object.assign(look, { armL: -26, foreL: -160, armR: 26, foreR: 160, fingers: 1, fist: t, zoom: 1.7, fx: 130, fy: 96 });
      break;
    case 1: // shoulders to the ears
      Object.assign(look, { shrug: t, zoom: 1.8, fx: 130, fy: 78 });
      break;
    case 2: // screwed-up face
      Object.assign(look, { squeeze: t, zoom: 3, fx: 130, fy: 42 });
      break;
    case 3: // tight abs
      Object.assign(look, { belly: t, zoom: 2, fx: 130, fy: 168 });
      break;
    case 4: // knees and thighs pressed together
      Object.assign(look, { legL: mixValue(-6, 10, t), legR: mixValue(6, -10, t), shinL: mixValue(-3, 1, t), shinR: mixValue(3, -1, t), zoom: 1.7, fx: 130, fy: 250 });
      break;
    default: // curled toes
      Object.assign(look, { toes: t, toesShown: 1, zoom: 2.6, fx: 130, fy: 322 });
  }
  return look;
}

export function WoodenMannequin({ tint = null, guide = null, interactive = true, className, label = 'Деревянная фигурка' }: WoodenMannequinProps) {
  const uid = useId().replace(/:/g, '');
  const [pose, setPose] = useState<Angles>(REST);
  const [look, setLook] = useState<Look>(REST_LOOK);
  const svg = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<Handle | null>(null);
  const target: Look = guide ? guidedLook(guide.step, guide.state) : { ...REST_LOOK, ...pose };

  // Ease the shown figure towards the target pose: free dragging follows quickly, guided steps move smoothly.
  const targetKey = JSON.stringify(target);
  const lookRef = useRef<Look>(REST_LOOK);
  useEffect(() => {
    let frame = 0;
    const speed = guide ? 0.09 : 0.5;
    const tick = () => {
      const current = lookRef.current;
      const next = { ...current } as Look;
      let moving = false;
      (Object.keys(target) as (keyof Look)[]).forEach((key) => {
        const delta = target[key] - current[key];
        if (Math.abs(delta) > 0.02) { next[key] = current[key] + delta * speed; moving = true; } else next[key] = target[key];
      });
      lookRef.current = next;
      setLook(next);
      if (moving) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [targetKey]);

  const shrugY = -look.shrug * 20;
  const shoulderL = { x: SHOULDER.l.x + look.shrug * 4, y: SHOULDER.l.y + shrugY };
  const shoulderR = { x: SHOULDER.r.x - look.shrug * 4, y: SHOULDER.r.y + shrugY };
  const elbowL = toward(shoulderL, look.armL, ARM);
  const wristL = toward(elbowL, look.foreL, FORE);
  const elbowR = toward(shoulderR, look.armR, ARM);
  const wristR = toward(elbowR, look.foreR, FORE);
  const kneeL = toward(HIP.l, look.legL, THIGH);
  const ankleL = toward(kneeL, look.shinL, SHIN);
  const kneeR = toward(HIP.r, look.legR, THIGH);
  const ankleR = toward(kneeR, look.shinR, SHIN);
  const headCentre = toward({ x: NECK.x, y: NECK.y + shrugY * 0.5 }, 180 + look.head, 30);

  const pivots: Record<Handle, Point> = {
    armL: shoulderL, foreL: elbowL, armR: shoulderR, foreR: elbowR,
    legL: HIP.l, shinL: kneeL, legR: HIP.r, shinR: kneeR, head: NECK,
  };

  const pointerPoint = useCallback((event: React.PointerEvent): Point | null => {
    const node = svg.current;
    const matrix = node?.getScreenCTM();
    if (!node || !matrix) return null;
    const point = node.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }, []);

  const canDrag = interactive && !guide;
  const start = (handle: Handle) => (event: React.PointerEvent) => {
    if (!canDrag) return;
    event.preventDefault();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    dragging.current = handle;
  };
  const move = (event: React.PointerEvent) => {
    const handle = dragging.current;
    if (!handle) return;
    const point = pointerPoint(event);
    if (!point) return;
    const pivot = pivots[handle];
    if (handle === 'head') {
      const fromUp = (Math.atan2(point.x - pivot.x, pivot.y - point.y) * 180) / Math.PI;
      setPose((current) => ({ ...current, head: -Math.max(-40, Math.min(40, fromUp)) }));
      return;
    }
    const angle = angleTo(pivot, point);
    setPose((current) => ({ ...current, [handle]: angle }));
  };
  const end = () => { dragging.current = null; };

  const colour = (...parts: MannequinPart[]) => {
    if (!tint || !parts.some((part) => tint.parts.includes(part))) return null;
    return tint.state === 'tense' ? `url(#${uid}-tense)` : tint.state === 'release' ? `url(#${uid}-release)` : `url(#${uid}-idle)`;
  };
  const wood = `url(#${uid}-wood)`;

  const limb = (from: Point, to: Point, width: number, part?: MannequinPart) => (
    <>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#8a5a2b" strokeWidth={width + 4} strokeLinecap="round" />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={(part && colour(part)) || wood} strokeWidth={width} strokeLinecap="round" />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(255,236,196,0.45)" strokeWidth={Math.max(2, width / 5)} strokeLinecap="round" transform="translate(-3 -2)" />
    </>
  );
  const joint = (at: Point, r = 8) => <circle cx={at.x} cy={at.y} r={r} fill="#a46d34" stroke="#6e4620" strokeWidth="2" />;
  const grip = (handle: Handle, at: Point) => (canDrag ? (
    <circle className="wm-grip" cx={at.x} cy={at.y} r="20" fill="transparent" onPointerDown={start(handle)} />
  ) : null);

  /** A hand: palm, four fingers and a thumb. A fist pulls the fingers in and makes them short and fat. */
  const hand = (wrist: Point, foreAngle: number, side: 1 | -1, part: MannequinPart) => {
    const fill = colour(part) || wood;
    const fist = look.fist;
    const centre = toward(wrist, foreAngle, 9);
    const perp = foreAngle + 90;
    const grown = look.fingers;
    const length = mixValue(17, 7, fist) * grown;
    const width = mixValue(5.2, 7.2, fist) * grown;
    const fingers = [-1.5, -0.5, 0.5, 1.5].map((offset) => {
      const base = toward(centre, perp, offset * mixValue(5.4, 4.6, fist));
      const tip = toward(base, foreAngle + offset * mixValue(11, 0, fist), length);
      return { base, tip, key: offset };
    });
    const thumbBase = toward(centre, perp + 180 * (side === 1 ? 1 : 0), 8);
    const thumbTip = toward(thumbBase, foreAngle + (side === 1 ? 40 : -40) * mixValue(1, 0.2, fist) + (side === 1 ? -0 : 0), mixValue(12, 8, fist));
    return (
      <g>
        <circle cx={centre.x} cy={centre.y} r={mixValue(mixValue(12.5, 10, grown), 12, fist * grown)} fill="#8a5a2b" />
        <circle cx={centre.x} cy={centre.y} r={mixValue(mixValue(10.7, 8.2, grown), 10.2, fist * grown)} fill={fill} />
        {grown > 0.05 ? fingers.map((finger) => (
          <g key={finger.key}>
            <line x1={finger.base.x} y1={finger.base.y} x2={finger.tip.x} y2={finger.tip.y} stroke="#8a5a2b" strokeWidth={width + 2.4} strokeLinecap="round" />
            <line x1={finger.base.x} y1={finger.base.y} x2={finger.tip.x} y2={finger.tip.y} stroke={fill} strokeWidth={width} strokeLinecap="round" />
          </g>
        )) : null}
        {grown > 0.05 ? (
          <>
            <line x1={thumbBase.x} y1={thumbBase.y} x2={thumbTip.x} y2={thumbTip.y} stroke="#8a5a2b" strokeWidth={8.4 * grown} strokeLinecap="round" />
            <line x1={thumbBase.x} y1={thumbBase.y} x2={thumbTip.x} y2={thumbTip.y} stroke={fill} strokeWidth={6 * grown} strokeLinecap="round" />
          </>
        ) : null}
      </g>
    );
  };

  /** A foot with five toes; curled toes are smaller and tucked in. */
  const foot = (ankle: Point, side: 1 | -1, part: MannequinPart) => {
    const fill = colour(part) || wood;
    const cx = ankle.x + side * 12;
    const cy = ankle.y + 8;
    const tuck = look.toes;
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx="17" ry="9" fill="#8a5a2b" />
        <ellipse cx={cx} cy={cy - 1} rx="15" ry="7.5" fill={fill} />
        {look.toesShown > 0.05 ? [0, 1, 2, 3, 4].map((index) => {
          const along = side * (13 - tuck * 6 + index * 0);
          const spread = (index - 2) * mixValue(3.6, 2.4, tuck);
          return (
            <circle
              key={index}
              cx={cx + along + side * 2}
              cy={cy + spread + 1}
              r={mixValue(2.9 - Math.abs(index - 2) * 0.25, 2.1, tuck)}
              fill="#8a5a2b"
              stroke={fill}
              strokeWidth="0.8"
              opacity={look.toesShown}
            />
          );
        }) : null}
      </g>
    );
  };

  // The face appears when a step needs it; the eyes narrow and the brow gathers while the face is screwed up.
  const faceVisible = guide?.step === 2;
  const face = (
    <g opacity={faceVisible ? 1 : 0} style={{ transition: 'opacity 0.5s ease' }}>
      <ellipse cx={headCentre.x - 9} cy={headCentre.y - 1} rx="3.4" ry={mixValue(3.6, 0.7, look.squeeze)} fill="#4a2c10" />
      <ellipse cx={headCentre.x + 9} cy={headCentre.y - 1} rx="3.4" ry={mixValue(3.6, 0.7, look.squeeze)} fill="#4a2c10" />
      <path d={`M ${headCentre.x - 14} ${headCentre.y - 9 + look.squeeze * 3} L ${headCentre.x - 4} ${headCentre.y - 10 + look.squeeze * 5}`} stroke="#4a2c10" strokeWidth="2.2" strokeLinecap="round" opacity={0.35 + look.squeeze * 0.65} />
      <path d={`M ${headCentre.x + 14} ${headCentre.y - 9 + look.squeeze * 3} L ${headCentre.x + 4} ${headCentre.y - 10 + look.squeeze * 5}`} stroke="#4a2c10" strokeWidth="2.2" strokeLinecap="round" opacity={0.35 + look.squeeze * 0.65} />
      <path d={`M ${headCentre.x - 16} ${headCentre.y - 4} l 5 2 M ${headCentre.x - 16} ${headCentre.y + 1} l 5 -1 M ${headCentre.x + 16} ${headCentre.y - 4} l -5 2 M ${headCentre.x + 16} ${headCentre.y + 1} l -5 -1`} stroke="#4a2c10" strokeWidth="1.6" strokeLinecap="round" opacity={look.squeeze} />
      <path d={`M ${headCentre.x - 8} ${headCentre.y + 13} Q ${headCentre.x} ${headCentre.y + mixValue(18, 13, look.squeeze)} ${headCentre.x + 8} ${headCentre.y + 13}`} fill="none" stroke="#4a2c10" strokeWidth="2.4" strokeLinecap="round" />
      <path d={`M ${headCentre.x - 3} ${headCentre.y + 4} l 3 5 l 3 -5`} fill="none" stroke="#6e4620" strokeWidth="1.6" strokeLinecap="round" opacity={0.6} />
    </g>
  );

  const beltWidth = 60 * (1 - look.belly * 0.18);
  const zoomTransform = `translate(${VIEW.x + VIEW.w / 2 - look.fx * look.zoom} ${VIEW.h / 2 - look.fy * look.zoom}) scale(${look.zoom})`;

  return (
    <svg
      ref={svg}
      className={['wooden-mannequin', className].filter(Boolean).join(' ')}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-label={label}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      style={{ touchAction: canDrag ? 'none' : undefined }}
    >
      <defs>
        <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f1c98d" /><stop offset="0.55" stopColor="#d9a45f" /><stop offset="1" stopColor="#bd8444" /></linearGradient>
        <linearGradient id={`${uid}-tense`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8f84" /><stop offset="1" stopColor="#ef4438" /></linearGradient>
        <linearGradient id={`${uid}-release`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7bf0be" /><stop offset="1" stopColor="#16b57a" /></linearGradient>
        <linearGradient id={`${uid}-idle`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c7b3ff" /><stop offset="1" stopColor="#8d6bf5" /></linearGradient>
      </defs>
      <g transform={zoomTransform}>
        <ellipse cx="130" cy="352" rx="62" ry="8" fill="rgba(60,40,20,0.14)" />

        {/* legs, behind the pelvis */}
        {limb(HIP.l, kneeL, 26, 'thighL')}{limb(kneeL, ankleL, 22)}{foot(ankleL, -1, 'footL')}
        {limb(HIP.r, kneeR, 26, 'thighR')}{limb(kneeR, ankleR, 22)}{foot(ankleR, 1, 'footR')}
        {joint(kneeL, 9)}{joint(kneeR, 9)}

        {/* torso: pelvis, waist ball, chest (the belly tightens, the abs show) */}
        <rect x={130 - (beltWidth + 4) / 2} y="184" width={beltWidth + 4} height="40" rx="16" fill="#8a5a2b" />
        <rect x={130 - beltWidth / 2} y="186" width={beltWidth} height="36" rx="14" fill={colour('belly') || wood} />
        <circle cx="130" cy="180" r="10" fill="#a46d34" stroke="#6e4620" strokeWidth="2" />
        <rect x="84" y="78" width="92" height="104" rx="30" fill="#8a5a2b" transform={`translate(0 ${shrugY * 0.35})`} />
        <rect x="86" y="80" width="88" height="100" rx="28" fill={colour('chest', 'belly') || wood} transform={`translate(0 ${shrugY * 0.35})`} />
        <rect x="92" y="86" width="22" height="64" rx="11" fill="rgba(255,236,196,0.35)" transform={`translate(0 ${shrugY * 0.35})`} />
        <line x1="130" y1="96" x2="130" y2="168" stroke="rgba(110,70,32,0.28)" strokeWidth="2" strokeLinecap="round" />
        <g opacity={look.belly} stroke="rgba(110,40,20,0.55)" strokeWidth="2.4" strokeLinecap="round">
          <line x1="104" y1="140" x2="156" y2="140" /><line x1="104" y1="154" x2="156" y2="154" /><line x1="106" y1="168" x2="154" y2="168" />
        </g>

        {/* arms */}
        {limb(shoulderL, elbowL, 20, 'shoulderL')}{limb(elbowL, wristL, 18)}
        {limb(shoulderR, elbowR, 20, 'shoulderR')}{limb(elbowR, wristR, 18)}
        <circle cx={shoulderL.x} cy={shoulderL.y} r="12" fill={colour('shoulderL') || '#a46d34'} stroke="#6e4620" strokeWidth="2" />
        <circle cx={shoulderR.x} cy={shoulderR.y} r="12" fill={colour('shoulderR') || '#a46d34'} stroke="#6e4620" strokeWidth="2" />
        {joint(elbowL)}{joint(elbowR)}
        {hand(wristL, look.foreL, -1, 'handL')}{hand(wristR, look.foreR, 1, 'handR')}

        {/* neck and head */}
        <rect x="122" y={58 + shrugY * 0.5} width="16" height="24" rx="7" fill="#a46d34" />
        <ellipse cx={headCentre.x} cy={headCentre.y} rx="25" ry="28" fill="#8a5a2b" />
        <ellipse cx={headCentre.x} cy={headCentre.y} rx="23" ry="26" fill={colour('head') || wood} />
        <ellipse cx={headCentre.x - 7} cy={headCentre.y - 9} rx="8" ry="11" fill="rgba(255,236,196,0.4)" opacity={faceVisible ? 0 : 1} />
        {face}

        {grip('armL', elbowL)}{grip('foreL', wristL)}{grip('armR', elbowR)}{grip('foreR', wristR)}
        {grip('legL', kneeL)}{grip('shinL', ankleL)}{grip('legR', kneeR)}{grip('shinR', ankleR)}
        {grip('head', headCentre)}
      </g>
    </svg>
  );
}

export const MANNEQUIN_HINT = 'Двигай пальцем локти, кисти, колени, стопы и голову — поза любая.';
