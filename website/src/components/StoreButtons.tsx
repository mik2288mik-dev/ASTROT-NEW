import { storeLinks } from '@/lib/site';

const labels = {
  googlePlay: 'Google Play',
  appStore: 'App Store',
  ruStore: 'RuStore',
};

export function StoreButtons({ fallback }: { fallback: string }) {
  const entries = Object.entries(storeLinks).filter(([, url]) => Boolean(url));
  if (entries.length === 0) return <span className="store-fallback">{fallback}</span>;
  return (
    <div className="store-buttons">
      {entries.map(([key, url]) => <a key={key} href={url} rel="noopener noreferrer">{labels[key as keyof typeof labels]}</a>)}
    </div>
  );
}
