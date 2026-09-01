import React, { useEffect, useRef, useState } from 'react';
import { NeboLogo } from '../components/brand/NeboLogo';
import { Loading } from '../components/ui/Loading';
import { STORE_RELEASE_CONFIG } from '../lib/storeReleaseConfig';
import { apiFetch } from '../services/apiClient';
import { getMobileBuildIdentity } from '../services/mobileBuildIdentity';

const REQUIRED_DOCUMENTS = ['terms', 'personal_data', 'entertainment_notice'] as const;

type LegalDocumentType = typeof REQUIRED_DOCUMENTS[number];

export interface LegalDocumentStatus {
  documentType: LegalDocumentType;
  requiredVersion: string;
  accepted: boolean;
  latestAction: 'accepted' | 'withdrawn' | null;
  latestDocumentVersion: string | null;
  latestCreatedAt: string | null;
}

export interface LegalAcknowledgementSummary {
  requiredVersions: Record<LegalDocumentType, string>;
  documents: LegalDocumentStatus[];
}

interface LegalAcknowledgementGateProps {
  language: 'ru' | 'en';
  initialSummary?: LegalAcknowledgementSummary | null;
  onAccepted: (summary: LegalAcknowledgementSummary) => void;
}

interface LegalAcknowledgementResponse extends LegalAcknowledgementSummary {
  success: true;
}

function hasAcceptedEveryDocument(summary: LegalAcknowledgementSummary | null): boolean {
  if (!summary) return false;
  return REQUIRED_DOCUMENTS.every((documentType) => (
    summary.documents.some((document) => document.documentType === documentType && document.accepted)
  ));
}

async function readLegalAcknowledgements(): Promise<LegalAcknowledgementSummary> {
  const response = await apiFetch('/api/users/legal-acknowledgements', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  const payload = await response.json().catch(() => null) as LegalAcknowledgementResponse | null;
  if (!response.ok || !payload?.success || !Array.isArray(payload.documents)) {
    throw new Error('Не удалось проверить согласия. Проверь соединение и попробуй ещё раз.');
  }
  return {
    requiredVersions: payload.requiredVersions,
    documents: payload.documents,
  };
}

function isAccepted(summary: LegalAcknowledgementSummary | null, documentType: LegalDocumentType) {
  return summary?.documents.some((document) => (
    document.documentType === documentType && document.accepted
  )) === true;
}

export function LegalAcknowledgementGate({
  language,
  initialSummary = null,
  onAccepted,
}: LegalAcknowledgementGateProps) {
  const [summary, setSummary] = useState<LegalAcknowledgementSummary | null>(initialSummary);
  const [termsAccepted, setTermsAccepted] = useState(() => isAccepted(initialSummary, 'terms'));
  const [personalDataAccepted, setPersonalDataAccepted] = useState(() => (
    isAccepted(initialSummary, 'personal_data')
  ));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<'terms' | 'personal_data' | null>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const personalDataRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialSummary && hasAcceptedEveryDocument(initialSummary)) {
      setSummary(initialSummary);
      setTermsAccepted(isAccepted(initialSummary, 'terms'));
      setPersonalDataAccepted(isAccepted(initialSummary, 'personal_data'));
      onAccepted(initialSummary);
      return;
    }

    let cancelled = false;
    if (initialSummary) {
      setSummary(initialSummary);
      setTermsAccepted(isAccepted(initialSummary, 'terms'));
      setPersonalDataAccepted(isAccepted(initialSummary, 'personal_data'));
    }
    setError('');
    setLoading(true);
    readLegalAcknowledgements()
      .then((nextSummary) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setTermsAccepted(isAccepted(nextSummary, 'terms'));
        setPersonalDataAccepted(isAccepted(nextSummary, 'personal_data'));
        if (hasAcceptedEveryDocument(nextSummary)) {
          onAccepted(nextSummary);
          return;
        }
        setLoading(false);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить документы.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialSummary, onAccepted]);

  const submit = async () => {
    if (submitting) return;
    if (!termsAccepted) {
      setInvalidField('terms');
      setError('Прими пользовательское соглашение, чтобы продолжить.');
      termsRef.current?.focus();
      return;
    }
    if (!personalDataAccepted) {
      setInvalidField('personal_data');
      setError('Подтверди согласие на обработку персональных данных.');
      personalDataRef.current?.focus();
      return;
    }

    setInvalidField(null);
    setError('');
    setSubmitting(true);

    try {
      const currentSummary = summary || await readLegalAcknowledgements();
      const identity = await getMobileBuildIdentity();
      const metadata = {
        source: 'onboarding_legal',
        language,
        ...(identity.appVersion ? { appVersionName: identity.appVersion } : {}),
        ...(identity.versionCode ? { appVersionCode: identity.versionCode } : {}),
        ...(identity.distributionChannel
          ? { distributionChannel: identity.distributionChannel }
          : {}),
      };

      for (const documentType of REQUIRED_DOCUMENTS) {
        if (isAccepted(currentSummary, documentType)) continue;
        const response = await apiFetch('/api/users/legal-acknowledgements', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ documentType, action: 'accepted', ...metadata }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(payload?.message || 'Не удалось сохранить согласие.');
        }
      }

      const refreshedSummary = await readLegalAcknowledgements();
      setSummary(refreshedSummary);
      setTermsAccepted(isAccepted(refreshedSummary, 'terms'));
      setPersonalDataAccepted(isAccepted(refreshedSummary, 'personal_data'));
      if (!hasAcceptedEveryDocument(refreshedSummary)) {
        throw new Error('Не все согласия сохранились. Попробуй ещё раз.');
      }
      onAccepted(refreshedSummary);
    } catch (requestError: unknown) {
      try {
        const refreshedSummary = await readLegalAcknowledgements();
        setSummary(refreshedSummary);
        setTermsAccepted(isAccepted(refreshedSummary, 'terms'));
        setPersonalDataAccepted(isAccepted(refreshedSummary, 'personal_data'));
      } catch {
        // Keep the selected checkboxes so the user can retry without repeating work.
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось сохранить согласия. Проверь соединение и попробуй ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading progress={100} />;

  return (
    <main className="legal-acknowledgement-screen fixed inset-0 z-[120] h-[100dvh] overflow-hidden bg-white text-[#171717]">
      <div
        className="mx-auto flex h-full min-h-0 w-full max-w-[30rem] flex-col px-5 py-3 sm:px-6"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="flex justify-center">
          <NeboLogo className="legal-acknowledgement-logo" size="header" priority />
        </div>
        <h1 className="mt-1 font-serif text-[1.7rem] font-normal leading-[1.05]">Согласия и условия</h1>
        <p className="mt-1.5 max-w-[27rem] text-[0.84rem] leading-[1.38] text-[#625f5a]">
          Прими условия NEBO и отдельно дай согласие на обработку персональных данных в
          соответствии с Федеральным законом № 152-ФЗ.
        </p>

        <div className="mt-3 border-y border-[#dedbd5]">
          <div className="flex min-h-12 items-start gap-3 border-b border-[#dedbd5] py-2.5">
            <input
              ref={termsRef}
              id="legal-terms"
              type="checkbox"
              checked={termsAccepted}
              disabled={loading || submitting}
              aria-invalid={invalidField === 'terms'}
              aria-describedby={invalidField === 'terms' ? 'legal-error' : undefined}
              className="mt-0.5 h-6 w-6 shrink-0 accent-[#111827]"
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                if (event.target.checked && invalidField === 'terms') {
                  setInvalidField(null);
                  setError('');
                }
              }}
            />
            <div className="min-w-0 text-[0.86rem] leading-[1.3]">
              <label htmlFor="legal-terms" className="cursor-pointer">Принимаю </label>
              <a
                href={STORE_RELEASE_CONFIG.termsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[#9b9892] underline-offset-2"
              >
                Пользовательское соглашение
              </a>
            </div>
          </div>

          <div className="flex min-h-12 items-start gap-3 py-2.5">
            <input
              ref={personalDataRef}
              id="legal-personal-data"
              type="checkbox"
              checked={personalDataAccepted}
              disabled={loading || submitting}
              aria-invalid={invalidField === 'personal_data'}
              aria-describedby={invalidField === 'personal_data' ? 'legal-error' : undefined}
              className="mt-0.5 h-6 w-6 shrink-0 accent-[#111827]"
              onChange={(event) => {
                setPersonalDataAccepted(event.target.checked);
                if (event.target.checked && invalidField === 'personal_data') {
                  setInvalidField(null);
                  setError('');
                }
              }}
            />
            <div className="min-w-0 text-[0.86rem] leading-[1.3]">
              <label htmlFor="legal-personal-data" className="cursor-pointer">Даю </label>
              <a
                href={STORE_RELEASE_CONFIG.consentUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[#9b9892] underline-offset-2"
              >
                согласие на обработку персональных данных
              </a>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[0.74rem] leading-[1.38] text-[#6b6862]">
          NEBO — информационно-развлекательный сервис. Материалы не гарантируют событий и не
          заменяют медицинскую, психологическую, юридическую или финансовую помощь. Подробнее — в{' '}
          <a
            href={STORE_RELEASE_CONFIG.privacyUrl}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[#9b9892] underline-offset-2"
          >
            Политике обработки данных
          </a>.
        </p>

        <div id="legal-error" role="status" aria-live="polite" className="min-h-8 pt-1 text-[0.78rem] leading-4 text-[#a12d2d]">
          {loading ? 'Проверяем документы…' : error}
        </div>

        <button
          type="button"
          aria-busy={submitting}
          disabled={loading || submitting}
          onClick={() => void submit()}
          className="mt-auto min-h-12 w-full rounded-full bg-[#171717] px-5 py-3 text-[0.94rem] font-medium text-white disabled:cursor-wait disabled:opacity-55"
        >
          Продолжить
        </button>
      </div>
    </main>
  );
}

export const legalAcknowledgementGateContract = {
  requiredDocuments: REQUIRED_DOCUMENTS,
  hasAcceptedEveryDocument,
} as const;
