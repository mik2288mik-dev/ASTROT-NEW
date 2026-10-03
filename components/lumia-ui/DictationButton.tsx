import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { isDictationAvailable, startDictation, type DictationSession } from '../../services/dictation';

type DictationButtonProps = {
  language: 'ru' | 'en';
  /** Receives each recognized phrase; the field decides how to insert it. */
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Microphone next to a text field. Shown only where speech recognition works
 * (Android system recognizer, Chrome, Safari); tap to speak, tap again to stop.
 */
export function DictationButton({ language, onText, disabled, className }: DictationButtonProps) {
  const ru = language === 'ru';
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState('');
  const session = useRef<DictationSession | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    let active = true;
    void isDictationAvailable().then((value) => { if (active) setAvailable(value); });
    return () => {
      active = false;
      session.current?.stop();
    };
  }, []);

  if (!available) return null;

  const toggle = () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    setNotice('');
    setListening(true);
    session.current = startDictation({
      language,
      prompt: ru ? 'Говори, NEBO запишет' : 'Speak, NEBO will type it',
      onText: (text) => onTextRef.current(text),
      onEnd: (outcome) => {
        setListening(false);
        session.current = null;
        if (outcome === 'denied') setNotice(ru ? 'Разреши доступ к микрофону в настройках браузера.' : 'Allow microphone access in the browser settings.');
        else if (outcome === 'error') setNotice(ru ? 'Не расслышали. Попробуй ещё раз.' : 'Did not catch that. Try again.');
      },
    });
  };

  return (
    <span className={['dictation', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={`dictation-button${listening ? ' is-listening' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? (ru ? 'Остановить диктовку' : 'Stop dictation') : (ru ? 'Надиктовать голосом' : 'Dictate')}
      >
        {listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
      </button>
      {notice ? <span className="dictation-notice" role="status">{notice}</span> : null}
    </span>
  );
}
