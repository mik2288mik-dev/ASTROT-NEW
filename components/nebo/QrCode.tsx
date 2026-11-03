import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** A QR code drawn as SVG squares, so a friend can scan the invite link from the screen. */
export function QrCode({ value, size = 120, label }: { value: string; size?: number; label: string }) {
  const cells = useMemo(() => {
    if (!value) return null;
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const dark: string[] = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) dark.push(`M${col} ${row}h1v1h-1z`);
      }
    }
    return { count, path: dark.join('') };
  }, [value]);
  if (!cells) return null;
  return (
    <svg className="nebo-qr" width={size} height={size} viewBox={`-2 -2 ${cells.count + 4} ${cells.count + 4}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={cells.count + 4} height={cells.count + 4} fill="#ffffff" />
      <path d={cells.path} fill="#0b0d12" />
    </svg>
  );
}
