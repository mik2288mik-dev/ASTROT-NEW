import React, { useEffect, useState } from 'react';
import { getText, getZodiacSign } from '../constants';
import { getCardById } from '../services/cardsService';
import type {
  Language,
  Card,
  ProReport as ProReportType,
  ProReportPlanetBlock,
  ProReportAspectBlock,
  ProReportHouseBlock,
} from '../types';

interface ProReportProps {
  userId: string;
  cardId: number;
  language: string;
  onBack: () => void;
}

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-semibold text-astro-highlight uppercase tracking-wider mb-3 mt-6 first:mt-0">
    {children}
  </h3>
);

const PlanetCard: React.FC<{ p: ProReportPlanetBlock; lang: Language }> = ({ p, lang }) => (
  <div className="p-3.5 rounded-xl bg-astro-card/50 border border-astro-border mb-2">
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm font-semibold text-astro-text">{p.planet}</span>
      <div className="flex items-center gap-2 text-xs text-astro-text/50">
        <span>{getZodiacSign(lang, p.sign)} {p.degree.toFixed(1)}°</span>
        {p.retrograde && (
          <span className="text-red-400/80 font-medium">{getText(lang, 'pro_report.retrograde')}</span>
        )}
        {p.house != null && (
          <span>{p.house} {getText(lang, 'pro_report.house_label')}</span>
        )}
      </div>
    </div>
    {p.interpretation && (
      <p className="text-xs text-astro-text/70 leading-relaxed mt-1">{p.interpretation}</p>
    )}
  </div>
);

const HouseCard: React.FC<{ h: ProReportHouseBlock; lang: Language }> = ({ h, lang }) => (
  <div className="p-3 rounded-xl bg-astro-card/40 border border-astro-border/60 mb-2">
    <div className="flex items-center justify-between mb-0.5">
      <span className="text-sm font-medium text-astro-text">
        {h.house} {getText(lang, 'pro_report.house_label')}
      </span>
      <span className="text-xs text-astro-text/50">{getZodiacSign(lang, h.sign)} {h.degree.toFixed(1)}°</span>
    </div>
    {h.interpretation && (
      <p className="text-xs text-astro-text/60 leading-relaxed mt-1">{h.interpretation}</p>
    )}
  </div>
);

const AspectCard: React.FC<{ a: ProReportAspectBlock; lang: Language }> = ({ a, lang }) => {
  const aspectSymbols: Record<string, string> = {
    conjunction: '☌', sextile: '⚹', square: '□', trine: '△', opposition: '☍',
  };
  const symbol = aspectSymbols[a.aspect] || a.aspect;
  return (
    <div className="p-3 rounded-xl bg-astro-card/40 border border-astro-border/60 mb-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-astro-text font-medium">{a.planet1}</span>
        <span className="text-astro-highlight">{symbol}</span>
        <span className="text-astro-text font-medium">{a.planet2}</span>
        <span className="text-xs text-astro-text/40 ml-auto">
          {a.angle.toFixed(1)}° · {getText(lang, 'pro_report.orb')} {a.orb.toFixed(1)}°
        </span>
      </div>
      {a.interpretation && (
        <p className="text-xs text-astro-text/60 leading-relaxed mt-1.5">{a.interpretation}</p>
      )}
    </div>
  );
};

const PointBlock: React.FC<{
  title: string;
  point: { sign: string; degree: number; interpretation: string } | null;
  lang: Language;
}> = ({ title, point, lang }) => {
  if (!point) return null;
  return (
    <div className="p-3.5 rounded-xl bg-astro-card/50 border border-astro-border mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-astro-text">{title}</span>
        <span className="text-xs text-astro-text/50">{getZodiacSign(lang, point.sign)} {point.degree.toFixed(1)}°</span>
      </div>
      {point.interpretation && (
        <p className="text-xs text-astro-text/70 leading-relaxed mt-1">{point.interpretation}</p>
      )}
    </div>
  );
};

export const ProReport: React.FC<ProReportProps> = ({ userId, cardId, language, onBack }) => {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const lang = (language || 'ru') as Language;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCardById(userId, cardId);
        if (res.success && res.card) {
          setCard(res.card as Card);
        }
      } catch (e: any) {
        console.error('[ProReport] Load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, cardId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-astro-text/60 text-sm">
        {getText(lang, 'loading')}
      </div>
    );
  }

  const report: ProReportType | undefined =
    card?.pro_report ||
    (card?.data_json?.pro_report as ProReportType | undefined);

  if (!report) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <h3 className="text-base font-semibold text-astro-text mb-2">
          {getText(lang, 'pro_report.unavailable')}
        </h3>
        <p className="text-sm text-astro-text/50 mb-6 max-w-[260px]">
          {getText(lang, 'pro_report.unavailable_desc')}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl border border-astro-border text-astro-text/70 text-sm"
        >
          {getText(lang, 'pro_report.back')}
        </button>
      </div>
    );
  }

  const hasPlanets = report.planets && report.planets.length > 0;
  const hasHouses = report.houses && report.houses.length > 0;
  const hasAspects = report.aspects && report.aspects.length > 0;
  const hasNorthNode = report.nodes?.north_node;
  const hasSouthNode = report.nodes?.south_node;
  const hasLilith = !!report.lilith;
  const hasChiron = !!report.chiron;
  const ib = report.interpretation_blocks;

  return (
    <div className="h-full overflow-y-auto scrollbar-hide px-4 pb-10">
      <div className="pt-4 pb-1">
        <h2 className="text-lg font-semibold text-astro-text">
          {getText(lang, 'pro_report.title')}
        </h2>
        {card?.name && (
          <p className="text-sm text-astro-text/50 mt-0.5">{card.name}</p>
        )}
      </div>

      {/* Interpretation blocks */}
      {ib?.configuration && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.configuration')}</SectionHeader>
          <p className="text-sm text-astro-text/80 leading-relaxed whitespace-pre-line mb-2">{ib.configuration}</p>
        </>
      )}
      {ib?.dominant_patterns && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.dominant_patterns')}</SectionHeader>
          <p className="text-sm text-astro-text/80 leading-relaxed whitespace-pre-line mb-2">{ib.dominant_patterns}</p>
        </>
      )}
      {ib?.karmic_themes && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.karmic_themes')}</SectionHeader>
          <p className="text-sm text-astro-text/80 leading-relaxed whitespace-pre-line mb-2">{ib.karmic_themes}</p>
        </>
      )}

      {/* Planets */}
      {hasPlanets && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.planets')}</SectionHeader>
          {report.planets.map((p, i) => (
            <PlanetCard key={`${p.planet}-${i}`} p={p} lang={lang} />
          ))}
        </>
      )}

      {/* Nodes */}
      {(hasNorthNode || hasSouthNode) && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.nodes')}</SectionHeader>
          <PointBlock title={getText(lang, 'pro_report.north_node')} point={report.nodes.north_node} lang={lang} />
          <PointBlock title={getText(lang, 'pro_report.south_node')} point={report.nodes.south_node} lang={lang} />
        </>
      )}

      {/* Lilith */}
      {hasLilith && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.lilith')}</SectionHeader>
          <PointBlock title={getText(lang, 'pro_report.lilith')} point={report.lilith} lang={lang} />
        </>
      )}

      {/* Chiron */}
      {hasChiron && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.chiron')}</SectionHeader>
          <PointBlock title={getText(lang, 'pro_report.chiron')} point={report.chiron} lang={lang} />
        </>
      )}

      {/* Houses */}
      {hasHouses && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.houses')}</SectionHeader>
          {report.houses.map((h, i) => (
            <HouseCard key={`house-${h.house}-${i}`} h={h} lang={lang} />
          ))}
        </>
      )}

      {/* Aspects */}
      {hasAspects && (
        <>
          <SectionHeader>{getText(lang, 'pro_report.aspects')}</SectionHeader>
          {report.aspects.map((a, i) => (
            <AspectCard key={`${a.planet1}-${a.planet2}-${i}`} a={a} lang={lang} />
          ))}
        </>
      )}

      <button
        onClick={onBack}
        className="w-full mt-8 py-3 rounded-2xl border border-astro-border text-astro-text/60 text-sm transition-colors active:bg-astro-card/40"
      >
        {getText(lang, 'pro_report.back')}
      </button>
    </div>
  );
};
