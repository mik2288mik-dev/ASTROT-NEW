import type {
  PromoBannerCategory,
  PromoBannerLayout,
} from '../lib/promoBannerManifest';

type PromoBannerProps = {
  category: PromoBannerCategory;
  userId: string;
  dayKey: string;
  placementKey: string;
  language: 'ru' | 'en';
  layout?: PromoBannerLayout;
  onOpen: () => void;
};

/** Advertising banners are intentionally disabled across every product surface. */
export function PromoBanner(_props: PromoBannerProps) {
  return null;
}
