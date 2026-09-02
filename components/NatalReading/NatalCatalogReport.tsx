import React, { useEffect, useMemo, useState } from 'react';
import {
  NatalCatalogReport as NatalCatalogReportBase,
} from './NatalCatalogReportBase';
import { HumanReport } from './HumanReport';
import {
  NATAL_CATALOG_FAILURE_EVENT,
  NATAL_READING_VARIANT_CHANGED_EVENT,
  natalReadingVariantLabel,
  readNatalReadingVariant,
  type NatalCatalogFailureDetail,
  type NatalReadingVariant,
  type NatalReadingVariantChangedDetail,
} from '../../lib/natalReading/readingVariant';

export type { NatalCatalogReportUiPreview } from './NatalCatalogReportBase';

type Props = React.ComponentProps<typeof NatalCatalogReportBase>;

export const NatalCatalogReport: React.FC<Props> = (props) => {
  const userId = String(props.profile.id || '');
  const language: 'ru' | 'en' = props.profile.language === 'en' ? 'en' : 'ru';
  const reportIdentity = useMemo(
    () => `${userId}:${props.chartId ?? 'primary'}`,
    [props.chartId, userId],
  );
  const [variant, setVariant] = useState<NatalReadingVariant>(() => (
    readNatalReadingVariant(userId, props.profile.isAdmin)
  ));
  const [fallbackCode, setFallbackCode] = useState('');

  useEffect(() => {
    setVariant(readNatalReadingVariant(userId, props.profile.isAdmin));
    setFallbackCode('');
  }, [props.profile.isAdmin, reportIdentity, userId]);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<NatalReadingVariantChangedDetail>).detail;
      if (!detail || detail.userId !== userId) return;
      setVariant(detail.variant);
      setFallbackCode('');
    };
    window.addEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(NATAL_READING_VARIANT_CHANGED_EVENT, handleChange);
  }, [userId]);

  useEffect(() => {
    const handleFailure = (event: Event) => {
      const detail = (event as CustomEvent<NatalCatalogFailureDetail>).detail;
      if (!detail || detail.userId !== userId || detail.kind !== 'category') return;
      if (detail.itemKey !== 'main') return;
      if (
        props.chartId != null
        && detail.chartId != null
        && Number(detail.chartId) !== Number(props.chartId)
      ) return;
      setFallbackCode(detail.code || 'NATAL_CATALOG_FAILURE');
    };
    window.addEventListener(NATAL_CATALOG_FAILURE_EVENT, handleFailure);
    return () => window.removeEventListener(NATAL_CATALOG_FAILURE_EVENT, handleFailure);
  }, [props.chartId, userId]);

  const effectiveVariant = variant === 'legacy' || (variant === 'auto' && fallbackCode)
    ? 'legacy'
    : 'catalog';

  if (effectiveVariant === 'legacy') {
    return (
      <>
        {props.profile.isAdmin ? (
          <p
            role="status"
            style={{
              margin: '0 16px 12px',
              padding: '9px 11px',
              borderRadius: 12,
              background: '#f8fafc',
              color: '#475569',
              fontSize: 12,
            }}
          >
            {language === 'ru'
              ? `Натальный разбор: ${natalReadingVariantLabel(variant, language)}${fallbackCode ? ` · новый вариант отклонён (${fallbackCode})` : ''}`
              : `Natal reading: ${natalReadingVariantLabel(variant, language)}${fallbackCode ? ` · new version rejected (${fallbackCode})` : ''}`}
          </p>
        ) : null}
        <HumanReport
          profile={props.profile}
          chartData={props.chartData}
          chartId={props.chartId}
          chartSubject={props.chartSubject}
          requestPremium={props.requestPremium}
          hideIntro={props.hideIntro}
          premiumContinuation={props.premiumContinuation}
          onPremiumContinuationHandled={props.onPremiumContinuationHandled}
          canPromotePremium={props.canPromotePremium}
          onOpenQuestions={props.onOpenQuestions}
          surface="reading"
        />
      </>
    );
  }

  return <NatalCatalogReportBase {...props} />;
};
