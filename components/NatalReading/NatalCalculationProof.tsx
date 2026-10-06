import React, { useMemo, useState } from 'react';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import {
  buildCalculationProof,
  formatCalculationProofText,
  verifyCalculationProof,
  type ProofVerification,
} from '../../lib/natalCalculationProof';
import styles from './NatalHighlights.module.css';

type Status = 'idle' | 'checking' | 'error';

function formatDifference(value: number): string {
  return `${value.toFixed(value < 0.1 ? 3 : 2).replace('.', ',')}°`;
}

export function NatalCalculationProof({ chart, name }: { chart: NatalChartDataV2; name: string }) {
  const proof = useMemo(() => buildCalculationProof(chart, name, 'ru'), [chart, name]);
  const [verification, setVerification] = useState<ProofVerification | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [notice, setNotice] = useState('');
  const checks = new Map((verification?.checks ?? []).map((check) => [check.key, check]));

  const verify = async () => {
    setStatus('checking');
    try {
      const engine = await import('astronomy-engine');
      setVerification(verifyCalculationProof(chart, engine, 'ru'));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  const text = () => formatCalculationProofText(proof, verification, 'ru');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setNotice('Данные скопированы');
    } catch {
      setNotice('Не получилось скопировать. Попробуй «Сохранить файл».');
    }
  };

  const save = async () => {
    const content = text();
    const fileName = `natal-chart-${proof.localDate}.txt`;
    try {
      const file = typeof File === 'function' ? new File([content], fileName, { type: 'text/plain' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Расчёт натальной карты' });
        return;
      }
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Файл сохранён');
  };

  const mark = (key: string) => {
    if (!verification) return null;
    const check = checks.get(key);
    if (!check) return <span className={styles.muted}>—</span>;
    return check.matches
      ? <span className={styles.ok}>✓ {formatDifference(check.difference)}</span>
      : <span className={styles.bad}>{formatDifference(check.difference)}</span>;
  };

  return (
    <section className={styles.proof} aria-labelledby="natal-proof-title">
      <h2 id="natal-proof-title" className={styles.heading}>Как посчитана карта</h2>
      <p className={styles.proofMeta}>
        {proof.localTime
          ? <>{proof.localTime} ({proof.timezone}{proof.utcOffsetText ? `, ${proof.utcOffsetText}` : ''}){proof.utc ? <> = {proof.utc.slice(11, 16)} по Гринвичу</> : null}</>
          : 'Время рождения не указано'}
        {' · '}{proof.place}, {proof.latitude.toFixed(4)}°, {proof.longitude.toFixed(4)}°
        {' · '}{proof.engine}{proof.engineVersion ? ` ${proof.engineVersion}` : ''}, тропический зодиак
        {proof.houseSystem === 'placidus' ? ', дома по Placidus' : proof.houseSystem === 'whole_sign' ? ', дома по знакам' : ''}
      </p>

      <table className={styles.proofTable}>
        <caption>Планеты и точки</caption>
        <tbody>
          {[...proof.bodies, ...proof.angles].map((row) => (
            <tr key={row.key}>
              <td>
                {row.label} · {row.signLabel} {row.degreeText}{row.retrograde ? ' R' : ''}
                {row.house ? <span className={styles.muted}> · {row.house} дом</span> : null}
              </td>
              <td>{mark(row.key)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {proof.houses.length ? (
        <table className={styles.proofTable}>
          <caption>Куспиды домов</caption>
          <tbody>
            {proof.houses.map((row) => (
              <tr key={row.house}>
                <td>{row.house} дом · {row.signLabel} {row.degreeText}</td>
                <td>{mark(`house-${row.house}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {verification ? (
        <p className={styles.verdict}>
          {verification.allMatch
            ? <><span className={styles.ok}>Совпадает.</span> Пересчитали второй, независимой библиотекой ({verification.library}), разница не больше {formatDifference(verification.maxDifference)}.</>
            : <><span className={styles.bad}>Есть расхождение.</span> Максимальная разница {formatDifference(verification.maxDifference)}. Напиши нам в поддержку, проверим.</>}
          {verification.unchecked.length
            ? <span className={styles.muted}> {verification.unchecked.join(', ')} второй библиотекой не считаются, их проверить так нельзя.</span>
            : null}
        </p>
      ) : (
        <button type="button" className={styles.verifyButton} onClick={verify} disabled={status === 'checking'}>
          {status === 'checking' ? 'Пересчитываем…' : 'Сверить независимым расчётом'}
        </button>
      )}
      {status === 'error' ? <p className={styles.status}>Сверка не загрузилась. Попробуй ещё раз.</p> : null}

      <div className={styles.actions}>
        <button type="button" onClick={copy}>Скопировать данные</button>
        <button type="button" onClick={save}>Сохранить файл</button>
      </div>
      {notice ? <p className={styles.status} role="status">{notice}</p> : null}
    </section>
  );
}
