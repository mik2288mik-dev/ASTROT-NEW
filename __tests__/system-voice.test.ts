import fs from 'fs';
import path from 'path';

const plays: Array<{ from: number; rate: number }> = [];
let callbacks: { onSentence: (index: number) => void; onEnd: () => void; onError: () => void } | null = null;
let halts = 0;
jest.mock('../services/speechEngine', () => {
  const actual = jest.requireActual('../services/speechEngine');
  return {
    ...actual,
    createSpeechSession: (_sentences: string[], _language: string, cb: typeof callbacks) => {
      callbacks = cb;
      return { play: (from: number, rate: number) => plays.push({ from, rate }), halt: () => { halts += 1; }, dispose: () => undefined };
    },
  };
});

import { splitIntoSentences } from '../services/speechEngine';
import { getPlaybackState, playSpeech, seekBy, setPlaybackRate, stopPlayback, togglePlayback } from '../services/audioPlayback';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('system voice for forecasts', () => {
  afterEach(() => {
    stopPlayback();
    plays.length = 0;
    halts = 0;
  });

  it('splits a reading into short sentences', () => {
    const sentences = splitIntoSentences('Привет. Твой прогноз на сегодня!\n\nУтро спокойное, а вечер — для разговоров… Хорошего дня.');
    expect(sentences).toEqual(['Привет.', 'Твой прогноз на сегодня!', 'Утро спокойное, а вечер — для разговоров…', 'Хорошего дня.']);
    const long = splitIntoSentences(`${'слово '.repeat(120)}конец.`);
    expect(long.every((part) => part.length <= 280)).toBe(true);
  });

  it('plays, pauses, skips by sentences and changes speed like a track', () => {
    const text = Array.from({ length: 12 }, (_, index) => `Это предложение номер ${index + 1} про обычный спокойный день.`).join(' ');
    playSpeech({ trackKey: 'forecast:day:2026-10-04', title: 'Слушать прогноз', text, language: 'ru' });
    expect(plays).toEqual([{ from: 0, rate: 1 }]);
    const state = getPlaybackState();
    expect(state.trackKey).toBe('forecast:day:2026-10-04');
    expect(state.playing).toBe(true);
    expect(state.duration).toBeGreaterThan(30);

    callbacks!.onSentence(3);
    expect(getPlaybackState().currentTime).toBeGreaterThan(8);

    seekBy(15);
    expect(plays[plays.length - 1].from).toBeGreaterThan(3);

    togglePlayback();
    expect(getPlaybackState().playing).toBe(false);
    expect(halts).toBe(1);
    togglePlayback();
    expect(getPlaybackState().playing).toBe(true);

    setPlaybackRate(1.5);
    expect(plays[plays.length - 1].rate).toBe(1.5);
    expect(getPlaybackState().duration).toBeCloseTo(state.duration / 1.5, 1);

    callbacks!.onEnd();
    expect(getPlaybackState().playing).toBe(false);
  });

  it('gives NEBO+ the studio voice and everyone else the phone voice', () => {
    expect(read('android/app/src/main/java/ru/tvoygoroskop/app/MainActivity.java')).toContain('registerPlugin(NativeTtsPlugin.class);');
    expect(read('android/app/src/main/AndroidManifest.xml')).toContain('android.intent.action.TTS_SERVICE');
    const button = read('components/audio/ListenForecastButton.tsx');
    expect(button).toContain("requestListen({ type: 'personal_forecast', period, periodKey })");
    expect(button).toContain('playSpeech(');
    expect(read('components/audio/AudioMiniPlayer.tsx')).toContain('onClick={stopPlayback}');
  });

  it('closing the player resets it so the listen button comes back', () => {
    playSpeech({ trackKey: 'forecast:day:2026-10-04', title: 'Слушать прогноз', text: 'Первое. Второе.', language: 'ru' });
    expect(getPlaybackState().trackKey).toBe('forecast:day:2026-10-04');
    stopPlayback();
    expect(getPlaybackState().trackKey).toBeNull();
    expect(getPlaybackState().playing).toBe(false);
  });
});
