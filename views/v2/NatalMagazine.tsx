import React from 'react';
import type { NatalChartData, NatalInterpretationReport, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { formatLumiaDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import { ShimmerStyles } from '../../components/NatalReading/Skeleton';
import { getLzArtSrc } from '../../lib/lzArtAssets';
import { LzArtPlate } from '../../components/lumia-ui/v2/LzArtPlate';
import { MonoButton, MonoIllustChart, MonoPage, MonoStagger, MonoStaggerItem, MonoTag } from '../../components/mono-ui';

type NatalMagazineProps = {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  onCreateChart?: () => void;
  onOpenPersonalDaily?: () => void;
};

export function NatalMagazine({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
  preloadedReport,
  onCreateChart,
  onOpenPersonalDaily,
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';

  if (!data) {
    return (
      <MonoPage className="lz-feed-page px-4 pt-4" withTabClearance>
        <div className="lz-feed-card mx-auto max-w-md overflow-hidden p-0">
          <MonoTag className="mx-5 mt-5">{language === 'ru' ? 'карта' : 'chart'}</MonoTag>
          <LzArtPlate
            imageSrc={getLzArtSrc('magazineCover')}
            fallback={<MonoIllustChart className="opacity-90" size={120} />}
            aspect="hero"
            className="mt-4 rounded-none"
          />
          <div className="px-5 pb-6 pt-4">
            <h1 className="font-lora text-[28px] font-bold leading-tight text-mono-ink">
              {language === 'ru' ? 'Создай натальную карту' : 'Create your natal chart'}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-mono-muted">
              {language === 'ru'
                ? 'Lumia рассчитает карту по дате, времени и месту рождения.'
                : 'Lumia calculates your chart from birth date, time, and place.'}
            </p>
            <MonoButton className="mt-6" fullWidth onClick={onCreateChart}>
              {language === 'ru' ? 'Создать карту' : 'Create chart'}
            </MonoButton>
          </div>
        </div>
      </MonoPage>
    );
  }

  return (
    <div className="min-h-full pb-16 font-sans">
      <ShimmerStyles />
      <MonoPage className="lz-feed-page px-4 pt-2" withTabClearance>
        <MonoStagger>
          <MonoStaggerItem>
            <section className="lz-feed-card overflow-hidden p-0">
              <LzArtPlate
                imageSrc={getLzArtSrc('magazineCover')}
                fallback={<MonoIllustChart size={120} className="mx-auto opacity-80" />}
                aspect="wide"
                className="rounded-none"
              />
              <div className="px-5 pb-5 pt-4">
                <MonoTag>{language === 'ru' ? 'журнал' : 'magazine'}</MonoTag>
                <h1 className="mt-3 font-lora text-[30px] font-bold leading-tight text-mono-ink">{profile.name}</h1>
                <p className="mt-2 text-[14px] text-mono-muted">
                  {formatLumiaDate(profile.birthDate, language)} · {profile.birthPlace}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-mono-line bg-mono-white px-3 py-1.5 text-[13px] font-semibold">
                    ☉ {getZodiacSign(language, data.sun.sign)}
                  </span>
                  <span className="rounded-full border border-mono-line bg-mono-white px-3 py-1.5 text-[13px] font-semibold">
                    ☾ {getZodiacSign(language, data.moon.sign)}
                  </span>
                  <span className="rounded-full border border-mono-line bg-mono-white px-3 py-1.5 text-[13px] font-semibold">
                    ↑ {getZodiacSign(language, data.rising.sign)}
                  </span>
                </div>
              </div>
            </section>
          </MonoStaggerItem>

          {onOpenPersonalDaily ? (
            <MonoStaggerItem>
              <MonoButton variant="outline" fullWidth className="mt-4" onClick={onOpenPersonalDaily}>
                {language === 'ru' ? 'Личный день' : 'Personal day'}
              </MonoButton>
            </MonoStaggerItem>
          ) : null}
        </MonoStagger>
      </MonoPage>

      <HumanReport
        profile={profile}
        chartData={data}
        chartId={chartId}
        requestPremium={requestPremium}
        onUpdateProfile={onUpdateProfile}
        preloadedReport={preloadedReport}
        onOpenPersonalDaily={onOpenPersonalDaily}
      />
    </div>
  );
}
