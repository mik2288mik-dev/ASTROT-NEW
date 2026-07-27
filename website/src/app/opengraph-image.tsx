import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Your Horoscope';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fa', color: '#18202b', fontSize: 72, fontWeight: 800, letterSpacing: '-4px' }}>
      Your Horoscope
    </div>,
    size,
  );
}
