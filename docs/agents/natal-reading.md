# Натальный разбор NEBO

Этот справочник описывает единственный действующий путь натального разбора. Он помогает менять текст, UI и API без возврата к старым независимым генераторам.

## Единственный путь

Натальный разбор всегда начинается с уже сохранённого расчёта. Не пересчитывай Swiss ради текста, карты, вопроса или смены языка.

```text
birth data
→ Swiss Ephemeris
→ saved NatalChartDataV2
→ lib/natalInterpretation
→ validated meanings
→ unified writer
→ Рассказ / По темам / Карта / Спросить о себе
```

Расчёт и сохранение не входят в scope текстового слоя: `lib/swisseph-calculator.ts`, `lib/birthTime.ts`, `lib/natalChartV2Types.ts`, `lib/natalChartCanonical.ts`, `lib/natalChartPersistence.ts`, `lib/natalChartV2Repository.ts`, `lib/natalChartRead.ts`, `pages/api/charts/index.ts` и `services/chartService.ts` не меняются при работе над разбором.

## Meanings и writer

`lib/natalInterpretation/` строит meanings только из надёжных evidence сохранённого `NatalChartDataV2`. При неизвестном или приблизительном времени рождения слой исключает нестабильные дома, углы и аспекты. Каждый meaning сохраняет связь с evidence IDs, а validation проверяет покрытие evidence и отсутствие дубликатов.

`lib/natalReading/unifiedGeneration.ts` передаёт writer только approved meanings и их IDs. Writer может переформулировать их в текст, но не добавляет биографию, причины поведения, травмы, диагнозы, события, мысли других людей, советы или видимую астрологию. Если writer не проходит structural или semantic validation, ответ не подменяется вторым генератором или свободным fallback.

## Экран и доступ

`views/v2/NatalMagazine.tsx` показывает один `NatalUnifiedReport`: `Рассказ` и `По темам` — два представления одного reading. Free получает проекцию того же полного reading без тем; Premium открывает полный reading и вопросы.

`components/NatalReading/mapExplanation.ts` строит объяснение выбранного элемента через тот же `buildNatalInterpretation()`. Технические данные можно показать как evidence, но карта не имеет собственных semantic tables. `lib/natalReading/natalQuestion.ts` выбирает approved meanings из того же слоя и выводит evidence IDs на сервере; raw chart не передаётся writer как второй источник трактовки.

`views/PersonalityReport.tsx` тоже использует `NatalUnifiedReport`. Сохранённая карта передаётся по своему `chartId`; вопросы доступны только для основной карты.

## Cache, retry и compatibility

`NATAL_UNIFIED_READING_CONTRACT_VERSION`, `NATAL_UNIFIED_READING_PROMPT_VERSION` и `NATAL_UNIFIED_READING_CACHE_KEY` из `lib/natalReading/unifiedReading.ts` определяют identity единого reading. Смена voice, contract или prompt не вызывает Swiss recalculation.

`pages/api/content/natal/reading.ts` и `lib/natalReading/unifiedApi.ts` работают с canonical snapshot, cache и generation lock. Ошибки возвращаются как retryable состояния; не сохраняй пустой или выдуманный успех.

`/human-base`, `/human-premium`, `/human-section`, `/catalog` и `/catalog-answer` остаются только compatibility endpoints для опубликованных APK. Они получают unified reading через `loadUnifiedReadingForLegacyEndpoint()` и проецируют его в старую JSON-форму через `legacyCompatibility.ts`. Не добавляй в них генерацию, cache или meaning engine.

## Голос

Общий голос задают `lib/voice/core.ts` и `lib/voice/validators.ts`. Натальный contract в `lib/voice/contracts/natal.ts` добавляет только границы натального текста. Не возвращай `narrativeVoice.ts`, старые prompts, catalog generation или отдельный semantic compiler.
