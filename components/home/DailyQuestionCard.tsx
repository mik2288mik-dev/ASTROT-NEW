import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { getTelegramInitDataHeaders } from '../../services/sessionService';
import { SIGN_FORMS_RU } from '../../lib/nativePushCopy';
import type { DailyQuestion, QuestionResults } from '../../lib/dailyQuestion';
import type { ZodiacSign } from '../../lib/zodiac-utils';

type QuestionState = {
  dayKey: string;
  question: DailyQuestion;
  sign: ZodiacSign | null;
  myVote: number | null;
  results: QuestionResults | null;
};

const SIGN_GEN_EN: Record<ZodiacSign, string> = {
  Aries: 'Aries', Taurus: 'Tauruses', Gemini: 'Geminis', Cancer: 'Cancers', Leo: 'Leos', Virgo: 'Virgos',
  Libra: 'Libras', Scorpio: 'Scorpios', Sagittarius: 'Sagittarians', Capricorn: 'Capricorns', Aquarius: 'Aquarians', Pisces: 'Pisceans',
};

async function request(method: 'GET' | 'POST', option?: number): Promise<QuestionState> {
  const response = await apiFetch('/api/daily-question', {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: method === 'POST' ? JSON.stringify({ option }) : undefined,
  }, 10_000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.code || 'QUESTION_UNAVAILABLE'), { code: payload.code });
  return payload as QuestionState;
}

/** «Вопрос дня»: one tap, then how people of your sign answered. */
export function DailyQuestionCard({ language, embedded = false }: { language: 'ru' | 'en'; embedded?: boolean }) {
  const ru = language === 'ru';
  const [state, setState] = useState<QuestionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void request('GET').then((loaded) => { if (active) setState(loaded); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!state) return null;
  const { question, results, myVote, sign } = state;

  const vote = async (option: number) => {
    if (busy || myVote !== null) return;
    setBusy(true);
    setNotice('');
    try {
      setState(await request('POST', option));
    } catch (error) {
      const code = (error as { code?: string }).code;
      setNotice(code === 'SIGN_REQUIRED'
        ? (ru ? 'Добавь дату рождения в профиле, и сможешь отвечать.' : 'Add your birth date to answer.')
        : code === 'VOTE_LIMIT'
          ? (ru ? 'С этой сети сегодня уже много ответов. Попробуй завтра.' : 'Many answers from this network today. Try tomorrow.')
          : (ru ? 'Не получилось отправить ответ. Попробуй ещё раз.' : 'Could not send the answer. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const top = results?.scope ? results.percents.indexOf(Math.max(...results.percents)) : -1;
  const groupLabel = results?.scope === 'sign' && sign
    ? (ru ? SIGN_FORMS_RU[sign].gen : SIGN_GEN_EN[sign])
    : (ru ? 'всех' : 'everyone');

  return (
    <section className={`daily-question${embedded ? ' is-embedded' : ''}`} aria-labelledby="daily-question-title">
      <p className="daily-question-kicker">{ru ? 'Вопрос дня' : 'Question of the day'}</p>
      {embedded
        ? <h3 id="daily-question-title">{question.text[language]}</h3>
        : <h2 id="daily-question-title">{question.text[language]}</h2>}
      <div className="daily-question-options">
        {question.options.map((option, index) => {
          const chosen = myVote === index;
          const percent = results?.scope ? results.percents[index] : null;
          return (
            <button
              key={option.ru}
              type="button"
              className={`daily-question-option${chosen ? ' is-chosen' : ''}${myVote !== null ? ' is-answered' : ''}`}
              onClick={() => { void vote(index); }}
              disabled={busy || myVote !== null}
              aria-pressed={chosen}
            >
              {percent !== null ? <span className="daily-question-fill" style={{ width: `${percent}%` }} aria-hidden="true" /> : null}
              <span className="daily-question-label">{chosen ? <Check size={15} aria-hidden="true" /> : null}{option[language]}</span>
              {percent !== null ? <b>{percent}%</b> : null}
            </button>
          );
        })}
      </div>
      {myVote !== null ? (
        <p className="daily-question-note">
          {results?.scope && top >= 0
            ? (ru
              ? `${results.percents[top]}% ${groupLabel} сегодня выбрали «${question.options[top].ru}». Ответов: ${results.total}.`
              : `${results.percents[top]}% of ${groupLabel} chose «${question.options[top].en}» today. Answers: ${results.total}.`)
            : (ru ? 'Ответ принят. Проценты покажем, когда ответов станет больше, загляни вечером.' : 'Answer saved. Percentages appear once more people answer, check back tonight.')}
        </p>
      ) : (
        <p className="daily-question-note">{ru ? 'Один ответ в день, потом покажем, что выбрали люди твоего знака.' : 'One answer a day, then see what people of your sign chose.'}</p>
      )}
      {notice ? <p className="daily-question-error" role="alert">{notice}</p> : null}
    </section>
  );
}
