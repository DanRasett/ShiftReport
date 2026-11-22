# Handoff: Dashboard CyberInfo

## Коротко

Первый этап redesign выполнен для Dashboard с приоритетом мобильного web. После проверки на ПК отдельно усилена читаемость desktop-версии, а палитра приведена к точным токенам CyberInfo в стиле «строгий минимализм».

## Что изменилось

- PRODUCT.md: зафиксированы пользователи, сценарии, ограничения и референс CyberInfo.
- DESIGN.md: описаны цвета, типографика, поверхности и responsive-правила.
- src/screens/DashboardScreen.tsx: новая мобильная шапка, основная метрика выручки, активность за 7 дней, товары и сотрудники.
- App.tsx: подключен локальный BravoRG, стандартный header скрыт только для Dashboard.
- assets/fonts/BravoRG.otf и assets/fonts/OFL_Bravo.txt: локальный шрифт и лицензия из CyberInfo.
- package.json и package-lock.json: добавлен expo-font.
- Desktop-режим Dashboard: увеличены рабочая ширина, отступы и размеры строк; мелкие подписи переведены с BravoRG на системный sans-serif.
- src/theme.ts: глобальные цвета синхронизированы с CyberInfo.
- Во всех TSX-экранах и модальных компонентах `borderRadius` приведен к нулю.

## Что проверено

- npx tsc --noEmit — без ошибок.
- npx expo export --platform web — успешно, шрифт попал в web assets.
- http://localhost:8081 — отвечает 200.
- Мобильный снимок через Microsoft Edge — Dashboard отрисовывается; окно входа SmartShell остается штатным и перекрывает часть данных до авторизации.
- Playwright не использован: в окружении нет Chrome, автоматическая установка завершилась ошибкой прав.

## Следующий шаг

Проверить Dashboard после входа и перейти к визуальной адаптации Drawer/экрана сдачи смены в той же системе.
