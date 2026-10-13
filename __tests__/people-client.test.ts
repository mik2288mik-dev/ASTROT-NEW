jest.mock('../services/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));

import { inviteCodeFromUrl, inviteMessage, normalizeInviteCodeInput } from '../services/peopleService';
import { birthdayLabel, daysUntilBirthday } from '../lib/people/birthdays';

describe('invite links', () => {
  it('reads the code from every kind of invite link', () => {
    expect(inviteCodeFromUrl('https://api.tvoi-goroskop.ru/i/K7M2PQ4X')).toBe('K7M2PQ4X');
    expect(inviteCodeFromUrl('https://api.tvoi-goroskop.ru/i/k7m2-pq4x?utm=tg')).toBe('K7M2PQ4X');
    expect(inviteCodeFromUrl('nebo://invite/K7M2PQ4X')).toBe('K7M2PQ4X');
    expect(inviteCodeFromUrl('https://api.tvoi-goroskop.ru/')).toBeNull();
    expect(inviteCodeFromUrl('not a url')).toBeNull();
  });

  it('accepts a typed code with or without the dash and rejects look-alike letters', () => {
    expect(normalizeInviteCodeInput(' k7m2-pq4x ')).toBe('K7M2PQ4X');
    expect(normalizeInviteCodeInput('K7M2PQ40')).toBeNull();
    expect(normalizeInviteCodeInput('K7M2')).toBeNull();
  });

  it('writes a plain invite without a long dash', () => {
    const text = inviteMessage('Маша', 'https://api.tvoi-goroskop.ru/i/K7M2PQ4X', 'K7M2-PQ4X');
    expect(text).toContain('Маша зовёт тебя в NEBO.');
    expect(text).toContain('https://api.tvoi-goroskop.ru/i/K7M2PQ4X');
    expect(text).toContain('K7M2-PQ4X');
    expect(text).not.toContain('—');
  });
});

describe('birthdays of close people', () => {
  const now = new Date(2026, 9, 13, 15, 0);

  it('counts local days to the next birthday, across the new year', () => {
    expect(daysUntilBirthday('10-13', now)).toBe(0);
    expect(daysUntilBirthday('10-14', now)).toBe(1);
    expect(daysUntilBirthday('10-12', now)).toBe(364);
    expect(daysUntilBirthday(null, now)).toBeNull();
  });

  it('says it in plain words', () => {
    expect(birthdayLabel('10-13', now)).toBe('День рождения сегодня');
    expect(birthdayLabel('10-14', now)).toBe('День рождения завтра');
    expect(birthdayLabel('10-18', now)).toBe('День рождения через 5 дней');
    expect(birthdayLabel('10-15', now)).toBe('День рождения через 2 дня');
    expect(birthdayLabel('03-06', now)).toBe('День рождения 6 марта');
  });
});
