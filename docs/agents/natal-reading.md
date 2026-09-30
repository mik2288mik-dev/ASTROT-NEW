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

Расчёт и сохранение не входят в scope текстового слоя: `lib/swisseph-calculator.ts`, `lib/birthTime.ts`, `lib/natalChartV2Types.ts`, `lib/natalChartCanonical.ts`, `lib/natalChartPersistence.ts`, `lib/natalChartV2Repository.ts`, `lib/natalChartRead.ts` и `services/chartService.ts` не меняются при работе над разбором. Обработчики сохранения карты и профиля ставят задачу подготовки текста только после успешного сохранения canonical snapshot; этот вызов не меняет расчёт карты.

## Meanings и writer

`lib/natalInterpretation/` строит meanings только из надёжных evidence сохранённого `NatalChartDataV2`. При неизвестном или приблизительном времени рождения слой исключает нестабильные дома, углы и аспекты. Каждый meaning сохраняет связь с evidence IDs, а validation проверяет покрытие evidence и отсутствие дубликатов.

`lib/natalReading/unifiedGeneration.ts` передаёт writer только approved meanings и их IDs. Writer может переформулировать их в текст, но не добавляет биографию, причины поведения, травмы, диагнозы, события, мысли других людей, советы или видимую астрологию. Если writer не проходит structural или semantic validation, ответ не подменяется вторым генератором или свободным fallback.

## Экран и доступ

`views/v2/NatalMagazine.tsx` показывает один `NatalUnifiedReport`: `Рассказ` и `По темам` — два представления одного reading. Free получает проекцию того же полного reading без тем; Premium открывает полный reading и вопросы.

`components/NatalReading/mapExplanation.ts` строит объяснение выбранного элемента через тот же `buildNatalInterpretation()`. Технические данные можно показать как evidence, но карта не имеет собственных semantic tables. `lib/natalReading/natalQuestion.ts` выбирает approved meanings из того же слоя и выводит evidence IDs на сервере; raw chart не передаётся writer как второй источник трактовки.

`views/PersonalityReport.tsx` тоже использует `NatalUnifiedReport`. Сохранённая карта передаётся по своему `chartId`; вопросы доступны только для основной карты.

## Cache, retry и compatibility

Identity сохранённого reading определяется картой, исходными данными рождения и языком. Версии writer и voice описывают происхождение текста и не сбрасывают готовый разбор. Смена подписки также не создаёт новый reading: Free и Premium получают разные проекции одного полного текста.

`lib/natalReading/preparation.ts` самостоятельно обрабатывает сохранённые в `natal_reading_jobs` задачи и восстанавливает отсутствующие разборы уже созданных карт. Задача записывает результат writer до проверки и продолжает с него после сбоя; исправления ограничены отклонёнными блоками. Неполное перечисление деталей не отклоняет готовый текст, но новые утверждения, противоречия и советы требуют исправления. Не сохраняй пустой или непроверенный успех.

`pages/api/content/natal/reading.ts` и compatibility endpoints только читают сохранённый reading, включая POST от опубликованных клиентов. Открытие раздела, переключение представлений и повторная загрузка не запускают writer. Первый сценарий создания карты ждёт готовности серверной задачи до завершения; последующие открытия читают результат. Раздел «Спросить» сохраняет отдельную генерацию ответа на каждый вопрос.

`/human-base`, `/human-premium`, `/human-section`, `/catalog` и `/catalog-answer` остаются только compatibility endpoints для опубликованных APK. Они получают unified reading через `loadUnifiedReadingForLegacyEndpoint()` и проецируют его в старую JSON-форму через `legacyCompatibility.ts`. Не добавляй в них генерацию, cache или meaning engine.

## Голос

Общий голос задают `lib/voice/core.ts` и `lib/voice/validators.ts`. Натальный contract в `lib/voice/contracts/natal.ts` добавляет только границы натального текста. Не возвращай `narrativeVoice.ts`, старые prompts, catalog generation или отдельный semantic compiler.
