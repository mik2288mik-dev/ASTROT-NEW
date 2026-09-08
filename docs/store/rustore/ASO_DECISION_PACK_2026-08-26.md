# MEOU RuStore ASO Decision Pack

Дата фиксации: 26 августа 2026 года  
Рынок: RuStore, Россия и русскоязычная аудитория СНГ  
Версия решения: v1 — зафиксировано до появления первых 14 дней стабильных данных  
Статус: decision-ready; изменения в RuStore Console и код приложения не выполнялись

## Артефакты исследования

- [Master Keyword Table](./ASO_KEYWORDS_2026-08-26.csv) — 258 уникальных запросов.
- [Competitor Matrix](./ASO_COMPETITORS_2026-08-26.csv) — 25 приложений и их публичные показатели.
- [TOP-1 Battle Map](./ASO_BATTLE_MAP_2026-08-26.csv) — 15 Tier S запросов × TOP-10, 150 строк.
- [ASO Copy Bank](./ASO_COPY_BANK_2026-08-26.md) — 24 title, 14 short, 3 full descriptions, FAQ и visual copy.
- [ASO Change Log](./ASO_CHANGE_LOG_2026-08-26.csv) — baseline и последовательные эксперименты.
- [ASOdesk Market Matrix](./ASO_ASODESK_MARKET_MATRIX_2026-08-26.csv) — 135 Google Play country-keyword rows across RU/KZ/BY/US/GB/CA/AU.
- [English Keyword Table](./ASO_EN_KEYWORDS_2026-08-26.csv) — 175 unique EN queries with tiers, product fit, negatives and US ASOdesk anchors.
- [Google Play Market Decisions](./ASO_GOOGLE_PLAY_MARKET_DECISIONS_2026-08-26.md) — bilingual metadata, country decisions and Play experiment plan.

Уровни доказательности:

- **OFFICIAL** — прямо сказано в документации RuStore.
- **EVIDENCE** — видимый факт живой выдачи или карточки RuStore на дату исследования.
- **PROXY** — косвенный показатель: Google Play, ASOdesk, насыщенность выдачи, metadata конкурентов.
- **HYPOTHESIS** — проверяемое предположение; не выдается за вес алгоритма.

## 1. Executive Summary

Главное решение: MEOU должен входить в рынок через кластер **натальной карты**, а не пытаться сразу выиграть самый широкий запрос «гороскоп».

Почему:

1. MEOU действительно строит натальную карту и продолжает ее ценность личным прогнозом и совместимостью.
2. По запросу «натальная карта» №1 занимает exact-title приложение с рейтингом 2,5, 10 оценками и 1 тыс.+ установок. Это сильный semantic gap, хотя новый листинг без истории все равно начинает с низкой winability.
3. Кластеры «личный гороскоп» и «совместимость по данным рождения» дают MEOU более ясное продуктовое превосходство, чем общий гороскоп по знаку.
4. «Гороскоп» и «астрология» остаются стратегическими трофеями. Атаковать их нужно после накопления рейтинга, отзывов, CVR и качественных установок.
5. «Матрица судьбы» имеет заметную конкурентную нишу, но в MEOU этой функции нет. Кластер остается в мониторинге и запрещен для metadata.

Зафиксированная ASO-конфигурация:

| Поле | Решение |
|---|---|
| Primary cluster | Натальная карта |
| Proposed ASO title | MEOU: натальная карта — 21 символ |
| Approved fallback title | MEOU |
| Short description | Личный гороскоп, натальная карта и совместимость. Без общих фраз. |
| Category | Образ жизни |
| Tags | Гороскопы; Самосовершенствование; Стиль жизни; Личные помощники; Энциклопедии |
| Первые три screenshots | Натальная карта → личный Today → неделя/месяц |
| First battle | Натальная карта с расшифровкой; личный гороскоп; совместимость по дате рождения |
| Head battle | Гороскоп; астрология — только после доказанного product/store traction |

TOP-1 — цель, а не гарантия. RuStore официально связывает видимость не только с metadata, но и с рейтингом, установками, конверсией, отзывами, актуальностью, фичерингом и продвижением.

## 2. Product Reality Check

### Что реально есть в первом release contract

| Возможность | Free | Premium |
|---|---|---|
| Своя натальная карта | 1 карта | 1 карта |
| Разбор натальной карты | Базовый | Глубокий разбор карты и личности |
| Личный Today | Начальная часть, 1–2 фрагмента | Полный Today, 4–6 фрагментов |
| Личные Week и Month | Нет | Да, по одной цельной истории |
| Гороскоп по знаку | Ежедневный | Дополнительные периоды только после проверки финального UI |
| Совместимость | По двум знакам | По двум натальным картам |
| Вопрос по карте | Нет | Короткий ответ ИИ в bottom sheet |
| Дополнительные карты | Нет | До 5 помимо своей |
| Подписки | Нет | 1 месяц, 3 месяца, 1 год; цены из RuStore |

Личный прогноз пишет ИИ по выбранному периоду и сохраненному personal/natal context. Это не отдельный вычисленный транзитный прогноз, поэтому в карточке нельзя обещать «реальные транзиты дня», точные даты событий или неизбежное будущее.

### Что нельзя рекламировать

- Матрица судьбы, психоматрица, нумерология, таро, Human Design.
- Гороскоп на завтра или годовой прогноз.
- Живой астролог, безлимитный чат, консультация человека 24/7.
- Друзья, мессенджер, социальная лента.
- Пробный период, скидка или промокод.
- 100% точность, гарантированные события, диагнозы и профессиональные рекомендации.
- Лунный календарь, ретроградный трекер и транзиты до проверки их доступности в финальном release UI.

### Jobs-to-be-Done

1. Построить карту рождения по дате, времени и месту и понять ее обычным языком.
2. Получить личный прогноз на сегодня, неделю или месяц, а не общий текст для знака.
3. Быстро проверить совместимость знаков.
4. Глубоко сравнить две натальные карты.
5. Получить короткий ответ по собственной карте.
6. Возвращаться за новым Today и продолжать чтение в Week/Month.

### Аудитории

- Пользователи с готовым интентом «построить/расшифровать натальную карту».
- Пользователи общих гороскопов, которым нужен более личный текст.
- Люди, проверяющие совместимость пары, семьи, друзей или коллег.
- Пользователи AI-астрологии, которым важен понятный ответ без чат-клона.
- Начинающие, которым нужны объяснения планет, домов и аспектов без сложного жаргона.

Acquisition: натальная карта, личный Today, гороскоп по знаку, совместимость знаков.  
Retention: Today/Week/Month, вопросы по карте, повторные чтения.  
Monetization: полный Today, Week/Month, глубокий разбор, совместимость двух карт, дополнительные карты.

## 3. Аудит официальных правил RuStore

Основные источники: [публикация приложения](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/app-publication), [рекомендации по ASO](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/aso-recommendations), [поисковые теги](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/app-publication/new-version-app/tags), [расчет рейтинга](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/rating), [работа с отзывами](https://www.rustore.ru/help/developers/publishing-and-verifying-apps/responses-to-reviews), [статистика](https://www.rustore.ru/help/developers/developer-statistics).

| Поле/механизм | Актуальное правило | Статус |
|---|---|---|
| Название | До 30 символов и уникально по текущей инструкции публикации | OFFICIAL |
| Конфликт документации | ASO-страница говорит «до 50 символов»; более конкретная страница формы говорит 30 | OFFICIAL conflict; использовать 30 |
| Краткое описание | До 80 символов | OFFICIAL |
| Полное описание | До 4000 символов; учитывать сворачивание около 2000 | OFFICIAL |
| Текстовая индексация | Название и описания названы индексируемыми metadata | OFFICIAL |
| Категория | Выбирается из списка | OFFICIAL |
| Теги | До 5; только из существующего списка | OFFICIAL |
| Влияние тегов | Страница тегов говорит о внешней видимости и будущем влиянии на внутренний поиск | OFFICIAL; не считать текущим сильным rank factor |
| Иконка | 512×512, PNG/JPG, до 3 МБ, фон по всей площади | OFFICIAL |
| Screenshots | Минимум 3 на каждый заявленный тип устройства, до 10; PNG/JPG | OFFICIAL |
| Видео | Ссылка на VK Видео; поддерживается фоновое видео | OFFICIAL |
| FAQ | До 10 Q&A в веб-карточке; полезно для понятности и внешнего SEO | OFFICIAL |
| Рейтинг | Высокий рейтинг повышает позиции; свежие оценки весят сильнее старых | OFFICIAL |
| Review SDK | Просить оценку после успешного целевого действия, не на старте | OFFICIAL |
| Установки | Большее число установок повышает вероятность попадания в топы | OFFICIAL |
| Конверсия | Иконка, screenshots, видео, описание и freshness улучшают card→install | OFFICIAL |
| Отзывы | Количество, качество и ответы разработчика влияют на доверие и рейтинг | OFFICIAL |
| Фичеринг | Может дать прирост установок; решение редакционное | OFFICIAL |
| Pay SDK | RuStore заявляет повышенную видимость приложениям с платежным SDK | OFFICIAL |
| Внешний трафик | Кнопка «Доступно в RuStore», VK Реклама, сайт, соцсети, email | OFFICIAL |
| Нативные A/B experiments | ASO-страница советует A/B-тесты, но публичная документация не подтверждает встроенный экспериментальный инструмент | UNKNOWN |
| Метрики Console | Просмотры, установки, обновления, card→install CVR, платежи и push | OFFICIAL |

## 4. Анализ рынка

Живая выдача RuStore показывает насыщенность, но количество результатов не является частотностью:

- «натальная карта» — 499 результатов;
- «гороскоп» — 500;
- «совместимость по дате рождения» — 500;
- «ИИ астролог» — 500;
- «матрица судьбы» — 500.

Ключевые наблюдения:

1. Exact/partial keyword в title часто совпадает с высокой позицией. Это **EVIDENCE корреляции**, но вес exact match не опубликован.
2. Лидер «натальная карта» удерживает №1 при рейтинге 2,5. Это окно для продукта с лучшей карточкой и качеством, но новому приложению все равно нужна история установок и свежих оценок.
3. В head «гороскоп» есть масштаб: «Гороскопы» Mail.ru имеет 90 тыс.+ установок и 888 оценок, хотя рейтинг 2,9 и обновление 2022 года.
4. Качественный benchmark — «Астрея»: 5,0, 418 оценок, свежее обновление, сильное обещание personal/natal/AI.
5. В совместимости выдача слабее и шумнее. Exact-title подтвержден только для лидера `совместимость знаков зодиака`; лидеры date/natal запросов имеют partial-title match, до 1 тыс. установок и слабый публичный proof. Это остается quick-win рынком.
6. Matrix-сегмент подтвержден сильным игроком «Матрица Судьбы. Психоматрица» — 5,0, 783 оценки, 7 тыс.+. MEOU туда не входит без продукта.

## 5. 25 конкурентов

Полные факты, URL, feature matrix, screenshots, tags, позиции и weaknesses находятся в [Competitor Matrix](./ASO_COMPETITORS_2026-08-26.csv).

| Benchmark | Видимый proof | Что перенять | Что не копировать |
|---|---|---|---|
| Астрея | 5,0 / 418 / 1 тыс.+ / fresh | Ясное personal promise, human language, social proof | Таро, trial, чат и транзиты — не функции MEOU |
| Натальная карта рассчитать… | 4,9 / 52 / 1 тыс.+ | Exact long-tail title, понятный calculate intent | Перегруженный title |
| Натальная карта | 2,5 / 10 / 1 тыс.+ | Сила точного совпадения title | Слабый quality proof |
| ENIGMATA | 4,8 / 56 / 10 тыс.+ | Freshness, daily habit, масштаб | Календарное позиционирование |
| Гороскоп | 4,7 / 52 / 3 тыс.+ | Exact head title | Слишком общий монопродукт |
| Гороскопы Mail.ru | 2,9 / 888 / 90 тыс.+ | Scale benchmark | Старая карточка и слабый рейтинг |
| Arcai | до 1 тыс., exact «ИИ Астролог» | Понятная AI-категория | Ожидание бесконечного чата |
| Анима | до 1 тыс., natal + compatibility | Двойной exact product fit | Недоказанный rating proof |

Категория рынка: 23 из 25 исследованных приложений находятся в «Образ жизни».

## 6. Полное семантическое ядро

[Master Keyword Table](./ASO_KEYWORDS_2026-08-26.csv) содержит 258 уникальных запросов:

- Tier S — 15;
- Tier A — 40;
- Tier B — 155;
- Tier C — 20;
- NEGATIVE — 28.

Частотность RuStore нигде не придумана. Там, где нет прямого volume, поле demand_proxy прямо говорит: «RuStore volume unavailable — proxy».

## 7. Master Keyword Table

Каждая строка содержит cluster, intent, product relevance, journey stage, availability, source type/evidence, demand proxy/score, competition, RuStore relevance, conversion, business/strategic value, winability, opportunity, tier, target и metadata placement.

## 8. PRIMARY Cluster

**Натальная карта**.

Роль: главный acquisition market и мост к retention/monetization.  
Основные exact phrases: натальная карта; натальная карта с расшифровкой; рассчитать натальную карту; натальная карта по дате рождения; расшифровка натальной карты; разбор натальной карты.

## 9. SECONDARY Clusters

1. Личный/персональный гороскоп.
2. Today/Week/Month и ежедневный прогноз.
3. Совместимость знаков.
4. Совместимость по дате рождения и двум натальным картам.
5. Гороскопы по всем 12 знакам.
6. ИИ-астролог и вопрос по карте — осторожный cluster, без chat promise.
7. Астрология/самопознание — широкий category reinforcement.

## 10. Tier S — TOP-1 targets

1. натальная карта с расшифровкой
2. натальная карта
3. совместимость по дате рождения
4. рассчитать натальную карту
5. личный гороскоп
6. гороскоп на сегодня
7. персональный гороскоп
8. совместимость натальных карт
9. совместимость знаков зодиака
10. гороскоп
11. ежедневный гороскоп
12. гороскоп на неделю
13. гороскоп на месяц
14. ИИ астролог
15. астрология

## 11. Tier A — TOP-3

40 mid-tail запросов: натальный гороскоп, асцендент, разбор карты, личные прогнозы по периодам, гороскоп по дате рождения, пользовательские формулировки совместимости, 12 знаков и более точные AI-intents. Полный список — в Master Keyword Table.

## 12. Tier B — TOP-10

155 релевантных расширений: элементы карты, дома/аспекты/планеты, знаковые варианты, бытовые формулировки, relationship intents и информационные запросы. Их задача — кластерное покрытие, а не дословный keyword dump.

## 13. Tier C — experiments

20 низкоуверенных long-tail формулировок. Использовать только после появления rank/CVR данных. Не занимать ими title и short.

NEGATIVE не является Tier C: это отдельный запрет. Матрица, таро, нумерология, завтра, годовой прогноз, сонник и другие отсутствующие функции имеют target Ignore.

## 14. TOP-20 Search Opportunities

По Opportunity Score:

| Запрос | Score | Цель |
|---|---:|---|
| натальная карта с расшифровкой | 90 | TOP-1 |
| натальная карта | 89 | TOP-1 |
| совместимость по дате рождения | 89 | TOP-1 |
| рассчитать натальную карту | 88 | TOP-1 |
| натальная карта по дате рождения | 88 | TOP-3 |
| личный гороскоп | 87 | TOP-1 |
| расшифровка натальной карты | 87 | TOP-3 |
| гороскоп на сегодня | 86 | TOP-1 |
| совместимость натальных карт | 85 | TOP-1 |
| персональный гороскоп | 85 | TOP-1 |
| совместимость знаков зодиака | 84 | TOP-1 |
| личный прогноз на сегодня | 84 | TOP-3 |
| значение натальной карты | 82 | TOP-10 |
| натальный гороскоп | 82 | TOP-3 |
| звездная карта рождения | 82 | TOP-10 |
| космограмма рождения | 82 | TOP-10 |
| интерпретация натальной карты | 82 | TOP-10 |
| асцендент | 82 | TOP-3 |
| натальный анализ | 82 | TOP-10 |
| разбор натальной карты | 82 | TOP-3 |

## 15. TOP-20 Strategic Battles

Порядок борьбы:

1. натальная карта
2. гороскоп
3. астрология
4. гороскоп на неделю
5. персональный гороскоп
6. ежедневный гороскоп
7. ИИ астролог
8. гороскоп на сегодня
9. натальная карта с расшифровкой
10. рассчитать натальную карту
11. совместимость знаков зодиака
12. совместимость по дате рождения
13. совместимость натальных карт
14. личный гороскоп
15. гороскоп на месяц
16. гороскоп по знакам зодиака
17. асцендент
18. разбор натальной карты
19. гороскоп по дате рождения
20. синастрия

«Матрица судьбы» не включена: высокий спрос при нулевой product relevance не является возможностью.

## 16. TOP-1 Battle Map

Полные TOP-10 по каждому запросу находятся в [Battle Map](./ASO_BATTLE_MAP_2026-08-26.csv).

| Tier S | №1 сейчас | Proof | Winability | Battle |
|---|---|---|---:|---|
| натальная карта | Натальная карта | 2,5 / 10 / 1 тыс.+ | 38 | Strategic |
| натальная карта с расшифровкой | ENIGMATA | 4,8 / 56 / 10 тыс.+ | 48 | Medium |
| рассчитать натальную карту | Натальная карта рассчитать… | 4,9 / 52 / 1 тыс.+ | 55 | Medium |
| гороскоп | Гороскоп | 4,7 / 52 / 3 тыс.+ | 28 | Strategic |
| гороскоп на сегодня | Гороскоп на сегодня | rating/install unknown | 65 | Quick win |
| ежедневный гороскоп | Ежедневный гороскоп | metrics unknown | 58 | Medium |
| личный гороскоп | Персональный гороскоп | 4,2 / 13 / 3 тыс.+ | 66 | Quick win |
| персональный гороскоп | Персональный гороскоп | 4,2 / 13 / 3 тыс.+ | 64 | Medium |
| гороскоп на неделю | Гороскопы Mail.ru | 2,9 / 888 / 90 тыс.+ | 52 | Medium |
| гороскоп на месяц | Гороскоп | metrics unknown | 70 | Quick win |
| совместимость знаков зодиака | Совместимость знаков зодиака | до 1 тыс. | 72 | Quick win |
| совместимость по дате рождения | Совместимость. Астрология | до 1 тыс. | 68 | Quick win |
| совместимость натальных карт | Анима | до 1 тыс. | 75 | Quick win |
| ИИ астролог | Arcai | до 1 тыс. | 52 | Medium |
| астрология | AI-Астролог… | 4,7 / 62 / 1 тыс.+ | 25 | Strategic |

Winability — исследовательская оценка, не прогноз алгоритма. Milestones 4,7+, 50–100 оценок и 1–10 тыс. установок в Battle Map — внутренние growth gates, не опубликованные требования RuStore.

## 17. Semantic Gap

Главные окна:

- Exact-title №1 «натальная карта» имеет рейтинг 2,5.
- В совместимости exact-title подтвержден для sign-запроса; лидеры date/natal запросов совпадают с интентом частично и имеют мало публичного proof.
- «Личный гороскоп» лидер имеет 4,2 и 13 оценок; MEOU сильнее по фактической персонализации.
- «Гороскоп на сегодня» имеет exact-match лидера без сильного видимого proof; у «гороскоп на месяц» лидер называется просто «Гороскоп», то есть это partial-title match.
- В выдаче много монопродуктов. MEOU закрывает карту → прогноз → совместимость одной сохраненной системой.

Главный gap MEOU: нет опубликованной истории, рейтинга, отзывов и установок; текущий title MEOU не объясняет категорию.

## 18. Opportunity Score

Все входы, кроме Winability, оцениваются 0–10:

Opportunity = ROUND(10 × (0,18×Demand + 0,20×Product relevance + 0,12×RuStore relevance + 0,16×Conversion + 0,12×Business + 0,10×Strategic + 0,06×(10−Competition) + 0,06×(Winability/10))).

Высокий спрос не компенсирует отсутствие продукта. Для NEGATIVE opportunity принудительно не используется как target.

## 19. Winability Score

Winability учитывает:

- соответствие query intent;
- реальное продуктовое преимущество;
- возможность естественно разместить exact phrase;
- слабость/шум текущей выдачи;
- текущую готовность rating/install proof;
- visual CVR readiness;
- риск ложного ожидания.

Оценка пересчитывается после 14, 30, 60 и 90 дней. До релиза она намеренно снижена отсутствием store history.

## 20. TOP title variants

Все 24 варианта и counts — в [Copy Bank](./ASO_COPY_BANK_2026-08-26.md).

| Rank | Title | Символов | Heuristic score |
|---:|---|---:|---:|
| 1 | MEOU: натальная карта | 21 | 92 |
| 2 | MEOU: личный гороскоп | 21 | 87 |
| 3 | MEOU: персональный гороскоп | 27 | 85 |
| 4 | MEOU: разбор натальной карты | 28 | 83 |
| 5 | MEOU: гороскоп сегодня | 22 | 81 |

Score — HYPOTHESIS для сравнения copy, не алгоритмический вес RuStore.

## 21. Рекомендуемый title

**MEOU: натальная карта**.

Он сохраняет бренд и покрывает главный exact head. Изменение не применено: текущая approved identity — MEOU, а репозиторная release-документация требует одинакового имени в Android label и RuStore Console. Нужен отдельный owner decision до публикации.

Если имя менять нельзя, оставляем MEOU и признаем ASO-handicap; компенсируем short, первые 500 символов, tags, screenshots и external acquisition.

## 22. TOP short descriptions

| Rank | Short | Символов |
|---:|---|---:|
| 1 | Личный гороскоп, натальная карта и совместимость. Без общих фраз. | 65 |
| 2 | Построй натальную карту и получай личный прогноз без эзотерической воды. | 72 |
| 3 | Гороскоп по знакам и личный прогноз на основе натальной карты. | 62 |

Еще 11 проверенных вариантов — в Copy Bank.

## 23. Рекомендуемое short description

**Личный гороскоп, натальная карта и совместимость. Без общих фраз.**

Это лучший баланс three-cluster coverage, понятности и conversion. Оно не обещает Premium бесплатно и не упоминает отсутствующие функции.

## 24. Full description strategy

- Первые 500 символов: natal + personal forecast + compatibility.
- Далее: четкое отличие личного прогноза от гороскопа по знаку.
- Отдельно и честно описать Free/Premium.
- Естественно использовать Today/Week/Month, «карта рождения», «по данным рождения», «две натальные карты».
- Один раз объяснить ИИ и границу расчетов.
- Не повторять 12 знаков более одного списка.
- Не вставлять matrix/tarot/numerology даже ради конкурентного трафика.

Рекомендация: balanced version из Copy Bank, 1932 символа. Aggressive ASO version 2543 символа использовать только как отдельный эксперимент после baseline.

## 25. Готовый рекомендуемый full description

Общий гороскоп может не знать о тебе ничего. MEOU создаёт личный прогноз на сегодня, неделю или месяц по выбранному периоду и сохранённому контексту натальной карты. Здесь же можно построить карту рождения, посмотреть гороскоп по знаку и проверить совместимость.

В «Личном гороскопе» нет набора одинаковых советов про любовь, работу и настроение. Today идёт последовательной историей дня. Неделя и месяц читаются как один связный рассказ, без календарной нарезки.

**ЧТО ЕСТЬ В MEOU**

• личный гороскоп на сегодня;  
• персональный прогноз на неделю и месяц;  
• натальная карта по данным рождения;  
• базовый и глубокий разбор натальной карты;  
• ежедневный гороскоп по знакам зодиака;  
• совместимость по знакам;  
• совместимость по двум натальным картам;  
• вопросы по сохранённой карте;  
• одна своя карта и до пяти дополнительных карт с Premium.

**FREE И PREMIUM**

В Free можно построить свою натальную карту, открыть базовый разбор, прочитать начальную часть Today, посмотреть ежедневный гороскоп по знаку и проверить совместимость знаков.

Premium открывает полный личный прогноз на сегодня, прогноз на неделю и месяц, глубокий разбор карты и личности, вопросы по карте, совместимость по двум рассчитанным картам и до пяти дополнительных сохранённых карт.

**КАК НАЧАТЬ**

1. Укажи данные рождения.
2. Сохрани рассчитанную натальную карту.
3. Открой личный гороскоп и выбери сегодня, неделю или месяц.
4. Перейди к совместимости или прогнозу по знаку, когда нужен другой взгляд.

Натальная карта рассчитывается отдельно. Личный прогноз создаёт ИИ по выбранному периоду и сохранённому контексту. Личный прогноз не выдаёт выдуманные транзиты, аспекты, даты событий или факты биографии за расчёт.

Прогнозы и разборы не обещают неизбежного будущего. Они помогают посмотреть на ситуацию с другой стороны и не заменяют медицинскую, психологическую, юридическую или финансовую помощь.

MEOU говорит на «ты»: прямо, спокойно и без эзотерической воды.

## 26. Keyword-to-field map

| Cluster | Title | Short | First 500 | Full | Tag | Screenshot |
|---|---:|---:|---:|---:|---:|---:|
| натальная карта | Да | Да | Да | Да | Гороскопы/Самосовершенствование | 1 |
| личный гороскоп | Альтернатива | Да | Да | Да | Личные помощники | 2 |
| Today/Week/Month | Нет | В вариантах | Да | Да | Нет | 2–3 |
| совместимость | Нет | Да | Да | Да | Стиль жизни | 4–5 |
| гороскоп по знакам | Альтернатива | В вариантах | Да | Да | Гороскопы | 6 |
| ИИ астролог | Нет | Нет | Только точное объяснение | Один раз | Нет | 7 |
| астрология/обучение | Нет | Нет | Нет | Естественно | Энциклопедии | 7 |
| матрица/таро/нумерология | Нет | Нет | Нет | Нет | Нет | Нет |

## 27. Категория и теги

Категория: **Образ жизни**. Evidence: 23 из 25 исследованных конкурентов используют ее.

Теги:

1. **Гороскопы** — прямой category fit.
2. **Самосовершенствование** — объяснения карты и самопознание без терапии.
3. **Стиль жизни** — daily/periodic use.
4. **Личные помощники** — личный forecast и вопросы по карте.
5. **Энциклопедии** — реальный образовательный раздел.

Эти теги видимы в текущих карточках конкурентов и потому подтверждены как существующие. Не использовать «События», «Социальные», «Медитация» или «Сон» без продуктового основания.

## 28. Screenshots storyboard

| № | Search intent | Headline | Supporting text | UI | Conversion purpose |
|---:|---|---|---|---|---|
| 1 | Натальная карта | Твоя натальная карта | Построй карту рождения и читай разбор понятным языком | Карта + начало базового разбора | Exact acquisition proof |
| 2 | Личный Today | Сегодня, но лично | Прогноз учитывает твои данные, а не только знак | Первый экран Today | Daily value |
| 3 | Week/Month | Неделя и месяц целиком | Один связный прогноз вместо общих рубрик | Reader с честной Premium отметкой | Retention/Premium |
| 4 | Совместимость знаков | Подходите ли вы друг другу | Начни с бесплатной совместимости по знакам | Free result | Low-friction install |
| 5 | Две карты | Сравни две натальные карты | Подробная совместимость по данным рождения | Two-chart result | Premium intent |
| 6 | Гороскоп по знаку | Гороскоп для твоего знака | Ежедневный общий прогноз для всех 12 знаков | Zodiac reader | Secondary acquisition |
| 7 | Вопрос/обучение | Спроси о своей карте | Короткий ответ ИИ по сохраненному контексту | Bottom sheet, не чат | Trust and depth |

Первые три кадра должны продавать без чтения описания. Использовать только реальный release UI и вымышленные demo-данные. Текущий screenshot shotlist остается BLOCKED_BY_FINAL_VISUALS.

## 29. Icon strategy

Текущая темно-синяя иконка с золотой сферой и орбитой уже сильнее большинства фиолетовых звездно-зодиакальных клише.

Направления:

1. **Рекомендуемое:** сохранить navy/gold orbital mark; увеличить читаемость силуэта на 48 px, не добавлять текст.
2. Светлое gold field + темный orbital mark — более высокий contrast, но выше similarity risk с fintech/premium.
3. Упрощенная круговая natal geometry внутри существующего бренда — тест после baseline, не до релиза.

Не использовать женский AI-портрет, колесо зодиака с мелкими символами, moon-face, Tarot imagery или буквы в мелком кегле.

## 30. Ranking Factors Evidence Table

| Factor | Type | Importance | Действие |
|---|---|---|---|
| Title relevance | OFFICIAL metadata + EVIDENCE | Very high candidate | Exact primary phrase без stuffing |
| Short/full description | OFFICIAL | High | Кластеры естественно, primary в первых 500 |
| Tags | OFFICIAL, текущий внутренний вес не подтвержден | Low/medium | 5 релевантных существующих тегов |
| Category | OFFICIAL field | Medium context | Образ жизни |
| Rating | OFFICIAL | High | Review SDK после positive event |
| Fresh rating | OFFICIAL | High | Постоянный white-hat review velocity |
| Installs | OFFICIAL | High | Organic + размеченный paid/external traffic |
| Install velocity | HYPOTHESIS/PROXY | Unknown | Смотреть, не накручивать |
| Card→install CVR | OFFICIAL | High | Icon + первые 3 screenshots + short |
| CTR | PROXY | Unknown | Использовать как creative diagnostic, не rank fact |
| Reviews and responses | OFFICIAL | High trust | SLA и конкретные ответы |
| Updates/freshness | OFFICIAL | Medium/high | Стабильные релизы и честный What’s New |
| Pay SDK | OFFICIAL | Visibility benefit claimed | Уже в release contract; требуется live proof |
| Review SDK | OFFICIAL | Rating acquisition mechanism | Интеграция после value event |
| External traffic | OFFICIAL | Growth input | Available in RuStore badge, сайт, VK Ads |
| Featuring | OFFICIAL | High episodic | Подать после polished release/creative |
| FAQ/video | OFFICIAL card features | CVR/SEO support | Заполнить FAQ, видео после baseline |
| Retention D1/D7/D30 | HYPOTHESIS as rank factor | Product-critical | Измерять отдельно |
| Uninstall rate | HYPOTHESIS | Unknown | Использовать internal proxy |
| Crashes/ANR | HYPOTHESIS as search factor | Product-critical | Нулевые P0/P1 и release monitoring |

RuStore не публикует веса. Нельзя превращать таблицу в псевдоформулу алгоритма.

## 31. Review/rating strategy

Показывать RuStore Review SDK только после:

- успешно построенной и открытой натальной карты;
- второго прочитанного Today;
- завершенного результата совместимости;
- успешно восстановленного Premium и последующего value event.

Не показывать на старте, после ошибки, paywall, отмены оплаты или подряд чаще одного controlled window. Не делать review gating: нельзя сначала спрашивать «понравилось?» и отправлять в RuStore только довольных.

SLA:

- 1–2★ — до 24 часов: признать проблему, запросить безопасные детали, назвать следующий шаг;
- 3★ — до 48 часов: уточнить missing value;
- 4–5★ — до 72 часов: коротко поблагодарить, не копировать один шаблон;
- после исправления — ответить в исходном треде.

Критичные rating risks: ошибка расчета времени/места, stuck generation, blank Today, purchase/restore mismatch, потеря карты, auth-link issue, медленный старт.

## 32. A/B strategy

Публично подтвержденного native A/B инструмента RuStore не найдено. Поэтому baseline и последовательные тесты:

1. 7 дней стабильной индексации без изменений.
2. Менять только один элемент.
3. Минимум 14 дней или достаточная выборка.
4. Записывать positions, impressions, page views, installs, CVR, rating и paid mix.
5. Не объявлять победителя при изменении внешнего трафика или релиза.

Порядок: title → short → screenshot 1 → screenshot 2/3 → full opening → icon. Полный шаблон — [Change Log](./ASO_CHANGE_LOG_2026-08-26.csv).

## 33. Launch 0–30

### Pre-launch

- Принять owner decision по title.
- Проверить category/tags в Console.
- Подготовить 7 реальных screenshots и минимум 3 обязательных.
- Проверить final signed build, login, natal calculation, forecast, purchase/restore.
- Настроить Review SDK trigger и analytics events.
- Создать baseline sheet по 15 Tier S и 40 Tier A.

### Day 0

- Опубликовать одну согласованную карточку.
- Зафиксировать timestamp индексации и все metadata.
- Проверить карточку/FAQ/video/links на web и device.
- Не менять metadata в первые часы.

### Days 1–3

- Views, installs, CVR, errors, crashes, payment funnel.
- Первые отзывы и support themes.
- Проверить индексацию exact title/short phrases.

### Days 4–7

- Ежедневно снимать Tier S/Tier A позиции в одинаковых условиях.
- Сравнить natal, personal, compatibility clusters.
- Не делать вывод по одному дню.

### Days 8–14

- Первый тест: short или screenshot 1, не оба.
- Развести organic, paid и external traffic.
- Исправить product blockers раньше ASO-текста.

### Days 15–30

- Принять решение по первому тесту.
- Расширить победивший cluster Tier A.
- Подать заявку на featuring только после stable quality proof.

## 34. Growth 30–60

- Удерживать primary natal metadata.
- Добавить landing/external creatives под natal и compatibility separately.
- Наращивать свежие отзывы после value events.
- Атаковать личный/персональный гороскоп и compatibility quick wins.
- Тестировать first screenshot, затем full opening.
- Расширять Tier B только там, где появилась индексация и conversion.

## 35. Growth 60–90

- При 4,7+ rating, стабильном CVR и отсутствии P0/P1 переходить к head battles.
- «Гороскоп»: progression indexation → TOP-50 → TOP-20 → TOP-10 → TOP-5 → TOP-3 → TOP-1.
- На каждом этапе сравнивать gap: metadata, CVR, rating/review velocity, installations, freshness.
- «Астрология» атаковать через category authority/full description, не stuffing title.
- Не менять primary cluster, пока natal не дал 30 дней данных или не доказал провал.

## 36. KPI dashboard

| KPI | Source | Cadence |
|---|---|---|
| RuStore MEOU Tier S/A positions; % TOP-1/3/10 | RuStore live search after MEOU publication | Daily first 30, weekly далее |
| Google Play benchmark positions | ASOdesk by country for `com.matricasudbu.app.astro`; never label as MEOU | Research/weekly |
| Google Play MEOU positions | ASOdesk only after `ru.tvoygoroskop.app` is indexed; never mix countries | Daily first 30, weekly далее |
| Search visibility | Separate dashboards by store, country and app package | Weekly |
| Impressions | ASOdesk country estimate; `Calc` remains pending | Weekly |
| Page views, installs, card→install CVR | RuStore Console | Daily/weekly |
| Organic/paid/external installs | Attribution/VK Ads/internal analytics | Weekly |
| Rating and rating count | RuStore | Daily |
| Review velocity/sentiment | RuStore CSV + manual coding | Weekly |
| D1/D7/D30 | Product analytics | Weekly/cohort |
| Crashes/errors | Release telemetry | Daily |
| Uninstall proxy | Returning device/user cohorts | Monthly |
| Branded/non-branded demand | Search positions + ASOdesk/proxy | Monthly |
| Premium conversion/restore errors | Server/RuStore payment analytics | Daily |

## 37. ASO Change Log

[ASO_CHANGE_LOG_2026-08-26.csv](./ASO_CHANGE_LOG_2026-08-26.csv) уже содержит baseline и первые пять planned experiments. Правило: Hypothesis → Baseline → Change → Observation → Result → Decision.

## 38. Blacklist

- Keyword stuffing и бессмысленные перестановки.
- Боты, купленные отзывы, fake accounts/ratings.
- Мотивированные манипулятивные установки.
- Clickbait, misleading screenshots и выдуманные функции.
- Имена конкурентов в metadata.
- Матрица/таро/нумерология до реальной реализации.
- Псевдонаучные гарантии, страх и фатализм.
- Скрытие Premium boundary.
- Одновременная смена title, short, icon и screenshots.
- Выдача paid lift за органический ASO-эффект.

## 39. Неизвестные данные и гипотезы

- Точный поисковый volume RuStore публично не раскрыт.
- ASOdesk Guru ASO access is active. Google Play Find & Track data was captured for RU, KZ, BY, US, GB, CA and AU; 135 raw rows are saved. RuStore remains a separate direct-live-search evidence stream in this pack.
- ASOdesk `0` is an estimator result, not proof of literally zero demand. `Calc` values were not replaced with guesses.
- ASOdesk benchmark ranks belong to `com.matricasudbu.app.astro`, not to MEOU.
- Нативный RuStore A/B mechanism не подтвержден.
- Веса title, tags, rating, installs и CVR не опубликованы.
- MEOU еще не имеет live rank, rating, reviews, installs и card CVR.
- Current Google Play flavor has no verified Play Billing purchase/restore path; Premium claims are blocked for Google Play until that capability is implemented and release-verified.
- Store listing не доказывает signed build, Console products, purchase/restore и callback.
- Final screenshots заблокированы до утверждения актуального release UI.
- Exact label «Дневник»/«Личный гороскоп» нужно унифицировать до съемки.

## 40. NEXT ACTION

1. **Сейчас:** утвердить или отклонить два public-name решения: RU `MEOU: натальная карта`; EN challenger `MEOU: Birth Chart & Horoscope`.
2. Для Google Play выбрать: free-only truthful listing сейчас либо сначала реализовать/проверить Play Billing. Premium-текст до этого не публиковать.
3. После решения обновить listing только отдельной задачей и синхронизировать Android label/Console для реально публикуемых локалей.
4. Сделать 7 RuStore screenshots по storyboard, начиная с natal → Today → Week/Month; Google free-only assets держать отдельно.
5. Заполнить RuStore карточку balanced full description, category и пять подтвержденных tags.
6. Получить final signed/device/payment proof до обещаний Premium.
7. В день публикации заполнить ASO-000 baseline и 14 дней ничего не менять одновременно.
8. Первый growth battle: личный гороскоп + совместимость; head «гороскоп» — только после quality proof.
9. Повторить ASOdesk export после индексации MEOU: текущие ranks относятся к benchmark-приложению и не являются baseline MEOU.

### Decision lock

До первого 14-дневного baseline зафиксированы:

- primary = натальная карта;
- short = выбранный вариант;
- category = Образ жизни;
- tags = пять выбранных;
- NEGATIVE blacklist;
- последовательный, а не пакетный experimentation.

Пересмотр допускается только при новом evidence: ASOdesk metrics, live RuStore positions, Console CVR, review themes или изменении реального продукта.

## Appendix A. ASOdesk multi-country evidence

The ASOdesk Find & Track capture is complete for seven Google Play countries. Calculation state is not complete: the exported matrix contains 99 ready rows and 36 rows still marked `Calc`.

- Russia: 30 RU queries;
- Kazakhstan: 15 RU Tier S queries;
- Belarus: 15 RU Tier S queries;
- United States: 30 EN queries;
- United Kingdom, Canada, Australia: 15 EN Tier S queries each.

Total: 135 country-keyword rows. The strongest head estimates in this snapshot were:

- Russia: `гороскоп` 2,171 / Difficulty 66; `натальная карта` 221 / 57;
- United States: `astrology` 1,894 / 70; `horoscope` 1,446 / 72;
- United Kingdom: `astrology` 261 / 72; `horoscope` 167 / 68;
- Canada: `astrology` 188 / 85; `horoscope` 38 / 77;
- Australia: `astrology` 95 / 63; `horoscope` 56 / 58.

The data supports a chart-first launch and a phased head-query fight. It does not support a promise of immediate TOP-1 for `гороскоп`, `horoscope` or `astrology`.

Google Play release caveat: current flavor has no verified Google Play Billing. The Google decision file therefore contains a current-flavor free-only draft and a separately blocked post-billing Premium draft.

Files:

- [ASO_ASODESK_MARKET_MATRIX_2026-08-26.csv](./ASO_ASODESK_MARKET_MATRIX_2026-08-26.csv) — raw country rows;
- [ASO_EN_KEYWORDS_2026-08-26.csv](./ASO_EN_KEYWORDS_2026-08-26.csv) — extended English semantic core;
- [ASO_GOOGLE_PLAY_MARKET_DECISIONS_2026-08-26.md](./ASO_GOOGLE_PLAY_MARKET_DECISIONS_2026-08-26.md) — RU/EN metadata and market decisions;
- [ASO_BATTLE_MAP_2026-08-26.csv](./ASO_BATTLE_MAP_2026-08-26.csv) — separate RuStore live-result evidence.
