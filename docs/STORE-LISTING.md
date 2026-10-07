# Store description update for 1.3.0

Draft copy for Firefox Add-ons and Chrome Web Store. Publish only alongside the reviewed, signed release. Existing store listings have not been changed.

## English

Download the right file from public GitHub Releases, or choose several files at once. Filter a release's uploaded assets by extension, search filenames, select individual files or all visible files, and see the total size before downloading. Checksums and signatures are available in the bulk list too. Copy selected links for use in a terminal or another download tool.

Bulk downloads run in a background queue with up to three active files. See individual results, retry failures and cancel remaining work. The browser asks for the optional Downloads permission only when you first start a bulk download. Queue state stays on your device and can be cleared from the queue page. The extension checks only its own downloads, has no telemetry and uses no additional website permissions. Bulk downloads support public repositories, up to 500 uploaded assets per release, and normal browser windows.

Version 1.3.0 also fixes stable/prerelease selection and expands partially visible release asset lists. Existing platform recommendations, installation guidance and optional GitHub connection remain available.

## Русский

Скачивайте подходящий файл из публичных GitHub Releases или выбирайте сразу несколько. Отфильтруйте прикреплённые файлы по расширению, найдите нужные по имени, отметьте отдельные файлы или все видимые и посмотрите общий размер перед загрузкой. Контрольные суммы и подписи тоже доступны в массовом списке. Выбранные ссылки можно скопировать для терминала или другого менеджера загрузок.

Фоновая очередь загружает до трёх файлов одновременно, показывает результат каждого файла, позволяет повторить ошибки и отменить оставшуюся работу. Необязательное разрешение «Загрузки» запрашивается только при первом запуске массового скачивания. Состояние очереди остаётся на вашем устройстве и удаляется кнопкой на её странице. Расширение проверяет только собственные загрузки, не содержит телеметрии и не требует доступа к дополнительным сайтам. Массовая загрузка работает с публичными репозиториями, до 500 прикреплённых файлов на релиз и в обычных окнах браузера.

Версия 1.3.0 также исправляет выбор стабильных и предварительных релизов и загрузку частично видимых списков файлов. Рекомендации для вашей платформы, подсказки установки и необязательное подключение GitHub сохраняются.

## Permission explanation

`downloads` is optional and requested by an explicit bulk-download click. It is used to start selected validated release assets, track only the extension's queue, recover accepted downloads after worker restart, retry errors and cancel the queue. The permission technically provides wider access to browser downloads; the extension does not enumerate general history or read downloaded contents. Revocation is available in browser settings. Read the updated canonical privacy policy before publication.
