import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import styles from '../../styles/PublicSite.module.css';

const TOPICS = [
  ['app', 'Работа приложения'],
  ['account', 'Вход и аккаунт'],
  ['payment', 'Оплата и Premium'],
  ['privacy', 'Персональные данные'],
  ['idea', 'Предложение'],
  ['other', 'Другое'],
] as const;

type Topic = typeof TOPICS[number][0];
type FieldName = 'name' | 'email' | 'topic' | 'message' | 'consent';
type FormErrors = Partial<Record<FieldName, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SupportForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<Topic>('app');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    topic: useRef<HTMLSelectElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
    consent: useRef<HTMLInputElement>(null),
  };

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (name.trim().length < 2) nextErrors.name = 'Напишите, как к вам обращаться.';
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Проверьте адрес email.';
    if (!TOPICS.some(([value]) => value === topic)) nextErrors.topic = 'Выберите тему обращения.';
    if (message.trim().length < 10) nextErrors.message = 'Опишите вопрос чуть подробнее.';
    if (!consent) nextErrors.consent = 'Нужно согласие, чтобы мы могли прочитать обращение и ответить.';
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setStatus('idle');

    const firstInvalid = (Object.keys(nextErrors) as FieldName[])[0];
    if (firstInvalid) {
      fieldRefs[firstInvalid].current?.focus();
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch('/api/site-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          topic,
          message: message.trim(),
          consent,
          company,
        }),
      });
      if (!response.ok) throw new Error('SUPPORT_REQUEST_FAILED');

      setStatus('sent');
      setMessage('');
      setConsent(false);
    } catch {
      setStatus('error');
    }
  };

  const describedBy = (field: FieldName, hintId?: string) => {
    const ids = [hintId, errors[field] ? `${field}-error` : ''].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : undefined;
  };

  return (
    <form className={styles.supportForm} onSubmit={handleSubmit} noValidate aria-busy={status === 'sending'}>
      <div className={styles.formIntro}>
        <div>
          <p className={styles.eyebrow}>Обращение в поддержку</p>
          <h2>Расскажите, что случилось</h2>
        </div>
        <p>Ответ придёт на указанный email.</p>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label htmlFor="name">Как к вам обращаться</label>
          <input
            ref={fieldRefs.name}
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
          />
          {errors.name ? <p id="name-error" className={styles.fieldError}>{errors.name}</p> : null}
        </div>

        <div className={styles.formField}>
          <label htmlFor="email">Email для ответа</label>
          <input
            ref={fieldRefs.email}
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email')}
          />
          {errors.email ? <p id="email-error" className={styles.fieldError}>{errors.email}</p> : null}
        </div>
      </div>

      <div className={styles.formField}>
        <label htmlFor="topic">Тема</label>
        <select
          ref={fieldRefs.topic}
          id="topic"
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value as Topic)}
          aria-invalid={Boolean(errors.topic)}
          aria-describedby={describedBy('topic')}
        >
          {TOPICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {errors.topic ? <p id="topic-error" className={styles.fieldError}>{errors.topic}</p> : null}
      </div>

      <div className={styles.formField}>
        <label htmlFor="message">Сообщение</label>
        <textarea
          ref={fieldRefs.message}
          id="message"
          name="message"
          rows={7}
          maxLength={3000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy('message', 'message-hint')}
        />
        <p id="message-hint" className={styles.fieldHint}>
          Не отправляйте пароль, коды из писем и данные банковской карты.
        </p>
        {errors.message ? <p id="message-error" className={styles.fieldError}>{errors.message}</p> : null}
      </div>

      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor="company">Компания</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      <div className={styles.consentField}>
        <label>
          <input
            ref={fieldRefs.consent}
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={describedBy('consent')}
          />
          <span>
            Согласен на обработку данных из обращения для получения ответа.{' '}
            <Link href="/privacy">Подробнее</Link>
          </span>
        </label>
        {errors.consent ? <p id="consent-error" className={styles.fieldError}>{errors.consent}</p> : null}
      </div>

      <div className={styles.formActions}>
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Отправляем…' : 'Отправить в поддержку'}
        </button>
        <div className={styles.formStatus} role="status" aria-live="polite">
          {status === 'sent' ? 'Сообщение отправлено. Мы ответим на указанный email.' : ''}
        </div>
        {status === 'error' ? (
          <p className={styles.formError} role="alert">
            Не получилось отправить сообщение. Попробуйте ещё раз немного позже.
          </p>
        ) : null}
      </div>
    </form>
  );
}
