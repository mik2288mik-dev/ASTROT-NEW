import { getNatalStorySystemPrompt, NATAL_CONTRACT_VERSION } from '../lib/voice/contracts/natal';
import {
  NATAL_COPY_REVISION,
  NATAL_PREVIOUS_COPY_REVISION,
  NATAL_UNIFIED_READING_PROMPT_VERSION,
} from '../lib/natalReading/unifiedReading';

describe('natal journal voice contract', () => {
  it('keeps Story and Topics as different writing genres', () => {
    const prompt = getNatalStorySystemPrompt('ru');

    expect(NATAL_CONTRACT_VERSION).toBe('natal-v6');
    expect(prompt).toContain('ДВА РАЗНЫХ ЖАНРА');
    expect(prompt).toContain('Пиши именно рассказ о человеке');
    expect(prompt).toContain('Каждый раздел пиши как хороший журнальный текст');
    expect(prompt).toContain('Не копируй абзацы из «Рассказа»');
  });

  it('forbids invented props and jokes that add facts', () => {
    const prompt = getNatalStorySystemPrompt('ru');

    expect(prompt).toContain('Не придумывай ради живости сцену, предмет, привычку, профессию, покупку, Wi-Fi');
    expect(prompt).toContain('Если она хоть немного добавляет новый факт — убери её');
  });

  it('forces a fresh saved-copy revision for the editorial replacement', () => {
    expect(NATAL_PREVIOUS_COPY_REVISION).toBe('conversational-reading-20260930-r2');
    expect(NATAL_COPY_REVISION).toBe('conversational-reading-20261001-journal-v1');
    expect(NATAL_UNIFIED_READING_PROMPT_VERSION).toContain('writer.v7');
  });
});
