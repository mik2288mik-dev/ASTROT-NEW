import type { Metrics, RetentionPoint, VersionStats } from '../productMetrics';
import type { WaitRow } from './productInsights';

export type Hint = { tone: 'good' | 'warn' | 'bad'; title: string; text: string; section?: 'journey' | 'people' | 'money' | 'quality' };

const pct = (part: number, total: number) => (total > 0 ? Math.round((part * 100) / total) : 0);

/** Plain advice from the numbers: what to look at first. Never more than five. */
export function buildHints(input: {
  metrics: Metrics;
  previous: Metrics;
  retention: RetentionPoint[];
  versions: VersionStats;
  waits: WaitRow[];
  myTrackerEnabled: boolean;
}): Hint[] {
  const { metrics: m, previous: p } = input;
  const hints: Hint[] = [];
  const activation = pct(m.activation.activated, m.activation.cohort);
  if (m.activation.cohort >= 3 && activation < 60) {
    hints.push({ tone: activation < 35 ? 'bad' : 'warn', section: 'journey', title: `Только ${activation}% новых получили карту за сутки`,
      text: 'Остальные уходят раньше. Открой «Путь и воронки», там видно, на каком шаге знакомства они бросают.' });
  }
  const reading = input.waits.find((w) => w.key === 'natal_reading');
  if (reading && reading.count >= 2 && (reading.medianSeconds || 0) >= 120) {
    hints.push({ tone: (reading.medianSeconds || 0) >= 600 ? 'bad' : 'warn', section: 'journey',
      title: `Разбор карты готовится в среднем ${Math.round((reading.medianSeconds || 0) / 60)} мин`,
      text: `Человек всё это время ждёт. ${reading.failed ? `И ${reading.failed} разборов вообще не получились. ` : ''}Стоит показывать карту сразу, а разбор догружать в фоне.` });
  } else if (reading && reading.failed >= 2) {
    hints.push({ tone: 'bad', section: 'quality', title: `${reading.failed} разборов карты не получились`, text: 'Люди не увидели свой разбор. Посмотри «Ошибки и версии».' });
  }
  if (m.paywallViewers >= 3 && m.buyers === 0) {
    hints.push({ tone: 'warn', section: 'money', title: `Экран оплаты открыли ${m.paywallViewers}, никто не купил`,
      text: `До оплаты дошли ${m.checkoutStarted}. Если начинают и бросают, проверь оплату RuStore; если даже не начинают, предложение не убеждает.` });
  }
  const d1 = input.retention.find((r) => r.day === 1);
  if (d1 && d1.cohort >= 5 && pct(d1.returned, d1.cohort) < 20) {
    hints.push({ tone: 'warn', section: 'people', title: `На следующий день возвращаются ${pct(d1.returned, d1.cohort)}%`,
      text: 'Нормально для приложений гороскопов 25–35%. Помогают утреннее уведомление с личным прогнозом и повод зайти завтра.' });
  }
  if (input.versions.outdated > 0 && input.versions.latest) {
    hints.push({ tone: 'warn', section: 'quality', title: `${input.versions.outdated} человек на старой версии`,
      text: `Последняя версия ${input.versions.latest}. Старые версии не получают исправления, напомни обновиться.` });
  }
  if (m.errors >= 5) {
    hints.push({ tone: 'bad', section: 'quality', title: `${m.errors} ошибок за период`, text: 'Открой «Ошибки и версии», там сгруппировано по причинам.' });
  }
  if (!input.myTrackerEnabled && m.firstLaunchesApp > 0) {
    hints.push({ tone: 'warn', title: 'Не видно, откуда приходят люди',
      text: 'MyTracker не присылает нам источник установки. Включи передачу данных в кабинете MyTracker, тогда у каждого человека появится реклама или кампания.' });
  }
  if (p.active > 0 && m.active < p.active * 0.7) {
    hints.push({ tone: 'warn', section: 'people', title: `Заходили меньше: ${m.active} против ${p.active}`, text: 'Сравнение с таким же периодом до этого.' });
  }
  if (!hints.length) hints.push({ tone: 'good', title: 'Явных проблем не видно', text: 'Цифры ровные. Загляни в «Путь и воронки», где теряются люди.' });
  return hints.slice(0, 5);
}
