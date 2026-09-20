import {
  APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH,
  readAppEntryAnnouncement,
} from '../lib/appEntryAnnouncement';

describe('app entry announcement', () => {
  it('returns an enabled, valid announcement', () => {
    expect(readAppEntryAnnouncement({
      enabled: true,
      id: '2026-09-20-maintenance',
      title: 'Техническое сообщение',
      message: 'Сегодня часть функций может открываться дольше обычного.',
    })).toEqual({
      id: '2026-09-20-maintenance',
      title: 'Техническое сообщение',
      message: 'Сегодня часть функций может открываться дольше обычного.',
    });
  });

  it.each([
    { enabled: false, id: 'hidden', title: 'Скрыто', message: 'Текст' },
    { enabled: true, id: 'not allowed space', title: 'Заголовок', message: 'Текст' },
    { enabled: true, id: 'too-long', title: 'Заголовок', message: 'x'.repeat(APP_ENTRY_ANNOUNCEMENT_MAX_MESSAGE_LENGTH + 1) },
  ])('does not publish an invalid setting: %o', (value) => {
    expect(readAppEntryAnnouncement(value)).toBeNull();
  });
});
