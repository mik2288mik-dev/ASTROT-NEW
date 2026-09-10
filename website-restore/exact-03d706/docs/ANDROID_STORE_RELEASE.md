# Android и RuStore: релиз NEBO

Этот документ описывает только действующую Android-сборку и следующий
релизный шаг. Исторические названия и планы других магазинов сюда не входят.

## Идентичность

| Поле | Значение |
|---|---|
| Публичное имя | `NEBO гороскоп натальная карта` |
| Package ID | `ru.tvoygoroskop.app` |
| Минимальный Android | Android 7.0, API 24 |
| Target / compile SDK | API 36 |
| Production API | `https://api.tvoi-goroskop.ru` |
| Магазин | RuStore |

Источники этих значений: `capacitor.config.ts`, `android/app/build.gradle` и
release-переменные окружения.

Package ID и домены с `tvoi-goroskop.ru` остаются техническими идентификаторами
текущего релиза. Публичный бренд приложения — только NEBO.

## Версия на модерации

Версия `1.0.0 (2)` отправлена на ручную модерацию RuStore. После одобрения
публикация остаётся ручной для 100% аудитории.

- APK: `C:\Users\user\Downloads\NEBO-RuStore-1.0.0\upload-final\NEBO-rustore-release-1.0.0-vc2.apk`
- Размер: 61 326 710 байт.
- SHA-256: `7AA6501B86442A37CFC25DC28C9B4E267FF196BD0AEF56D97A6314C47FD1A6B2`.
- Подпись: APK Signature Scheme v2, RSA 4096.
- SHA-256 сертификата:
  `55037E5A70DAFEC00B9A2324423A97626BD0F678D3CCF5D48F25ED01DC596F0B`.
- Итоговые разрешения: `INTERNET`, `ACCESS_NETWORK_STATE`,
  `RECEIVE_BOOT_COMPLETED` и внутреннее
  `ru.tvoygoroskop.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.
- В manifest запрещены cleartext traffic и Android backup.
- Версию нельзя отзывать, заменять или публиковать без новой команды владельца.

## Настройки магазина

- Подписки опубликованы: 1 месяц — 399 ₽, 3 месяца — 899 ₽, 1 год — 2 999 ₽.
- Product ID: `premium_month`, `premium_quarter`, `premium_year`.
- RuStore Console App ID: `2063750823`.
- Пробного периода нет.
- Для товаров указано «Без НДС»; диапазон дохода — до 20 млн ₽.
- RuStore Pay проверяет покупку на сервере до выдачи Premium.
- Боевые callback-уведомления включены; тестовый callback принят.
- Callback:
  `https://api.tvoi-goroskop.ru/api/payments/rustore/notifications`.
- Иконка и восемь скриншотов загружены. Их источники записаны в
  `docs/store/common`.

Тестовый callback подтверждает доставку и разбор уведомления, но не заменяет
проверку реальной покупки, восстановления и выдачи Premium на устройстве.

## Локальная сборка

Release-секреты подписи, RuStore и OAuth передаются только через локальное или
серверное окружение и не записываются в Git.

RuStore-успех на клиенте сам по себе не выдаёт Premium: callback
расшифровывается AES-256-GCM, сохраняется в очереди и сверяется с Public API.
Покупка привязывается к стабильному `AppUserId`. Постоянный signing key нельзя
менять между обновлениями.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
npm run android:validate:release
npm run android:rustore:apk
npm run android:rustore:inspect
```

Для следующей сборки `APP_VERSION_CODE` должен быть больше `2`. `APP_VERSION_NAME`
задаётся только после решения о составе обновления. Мобильный API URL обязан
быть абсолютным HTTPS URL.

## Следующая версия

Локально готовится версия с кодом `3`:

- убрать черновые пометки и незаполненные значения из legal-страниц;
- добавить отдельное, заранее не отмеченное согласие на обработку персональных
  данных до отправки данных профиля;
- сохранить версию согласия, время, источник, язык и отзыв;
- проверить итоговые разрешения, API URL, подпись, покупки и восстановление на
  физическом Android-устройстве.

Загрузка этой сборки в RuStore — отдельное действие после результата модерации
версии `2` или новой прямой команды владельца.
