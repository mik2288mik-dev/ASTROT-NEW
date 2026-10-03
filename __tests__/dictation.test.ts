import fs from 'fs';
import path from 'path';
import { appendDictatedText } from '../services/dictation';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('dictation', () => {
  it('appends phrases like typed text', () => {
    expect(appendDictatedText('', 'когда лучше переезжать')).toBe('Когда лучше переезжать');
    expect(appendDictatedText('Когда лучше переезжать', 'этой осенью')).toBe('Когда лучше переезжать этой осенью');
    expect(appendDictatedText('Привет.', 'как дела')).toBe('Привет. Как дела');
    expect(appendDictatedText('Привет  ', 'мир', 8)).toBe('Привет м');
  });

  it('uses the system recognizer on Android without a microphone permission', () => {
    const plugin = read('android/app/src/main/java/ru/tvoygoroskop/app/speech/NativeSpeechPlugin.java');
    const activity = read('android/app/src/main/java/ru/tvoygoroskop/app/MainActivity.java');
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(plugin).toContain('@CapacitorPlugin(name = "NativeSpeech")');
    expect(plugin).toContain('RecognizerIntent.ACTION_RECOGNIZE_SPEECH');
    expect(activity).toContain('registerPlugin(NativeSpeechPlugin.class);');
    expect(manifest).toContain('android.speech.action.RECOGNIZE_SPEECH');
    expect(manifest).not.toContain('RECORD_AUDIO');
  });

  it('puts a microphone next to every free-text field', () => {
    for (const file of [
      'components/NatalReading/NatalQuestionExperience.tsx',
      'views/Settings.tsx',
      'components/home/WishesSheet.tsx',
      'components/home/MonthReviewSheet.tsx',
    ]) {
      expect(read(file)).toContain('<DictationButton');
    }
  });
});
