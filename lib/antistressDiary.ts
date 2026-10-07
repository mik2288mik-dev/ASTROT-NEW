const WEEKDAYS_ON = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'];

/** A short reading of the week from the person's own marks: average, hardest and calmest day, direction, what goes with high tension. */
export function weeklyDiarySummary(marks: ReadonlyArray<{ day: string; level: number; causes: readonly string[] }>): string[] {
  const filled = marks.filter((mark) => mark.level > 0);
  if (filled.length < 2) {
    return ['Когда будет хотя бы две отметки, здесь появится разбор: среднее за неделю, самый тяжёлый и самый спокойный день и что выбивает чаще всего.'];
  }
  const dayName = (day: string) => WEEKDAYS_ON[(new Date(`${day}T12:00:00`).getDay() + 6) % 7];
  const average = filled.reduce((sum, mark) => sum + mark.level, 0) / filled.length;
  const hardest = filled.reduce((best, mark) => (mark.level > best.level ? mark : best), filled[0]);
  const calmest = filled.reduce((best, mark) => (mark.level < best.level ? mark : best), filled[0]);
  const lines: string[] = [`В среднем ${average.toFixed(1).replace('.', ',')} из 5 по ${filled.length} отметкам.`];
  if (hardest.level !== calmest.level) {
    lines.push(`Тяжелее всего было ${dayName(hardest.day)} (${hardest.level}), спокойнее всего ${dayName(calmest.day)} (${calmest.level}).`);
  }
  const half = Math.floor(filled.length / 2);
  const early = filled.slice(0, half).reduce((sum, mark) => sum + mark.level, 0) / Math.max(1, half);
  const late = filled.slice(-half).reduce((sum, mark) => sum + mark.level, 0) / Math.max(1, half);
  if (filled.length >= 4 && Math.abs(late - early) >= 0.7) lines.push(late > early ? 'К концу недели напряжение растёт: стоит заранее добавить спокойные паузы.' : 'К концу недели напряжение снижается, так держать.');
  const counts = new Map<string, number>();
  filled.forEach((mark) => mark.causes.forEach((cause) => counts.set(cause, (counts.get(cause) ?? 0) + 1)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) {
    const withCause = filled.filter((mark) => mark.causes.includes(top[0]));
    const without = filled.filter((mark) => !mark.causes.includes(top[0]));
    if (without.length) {
      const a = withCause.reduce((sum, mark) => sum + mark.level, 0) / withCause.length;
      const b = without.reduce((sum, mark) => sum + mark.level, 0) / without.length;
      if (a - b >= 0.5) lines.push(`Когда выбивало «${top[0].toLowerCase()}», напряжение выше в среднем на ${(a - b).toFixed(1).replace('.', ',')}.`);
    }
  }
  if (average >= 3.8) lines.push('Напряжение высокое: начни с двухминутного дыхания, оно ждёт в разделе «Дыхание».');
  return lines;
}
