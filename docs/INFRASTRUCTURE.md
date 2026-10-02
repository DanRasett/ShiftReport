# Инфраструктура ShiftReport

## Контур

```text
Expo / React Native / Web
        │
        ├── SmartShell SDK — авторизация и данные смен
        ├── AsyncStorage — offline-кэш и черновики
        └── Supabase REST — отчёты, сотрудники, штрафы и настройки

Web → Netlify
iOS / Android → EAS Build and Submit
Supabase → PostgreSQL + migrations
```

## Локальный запуск

1. Скопируйте `.env.example` в `.env.local`.
2. Укажите `EXPO_PUBLIC_SUPABASE_URL` и `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Установите зависимости: `npm ci`.
4. Запустите web: `npm run web` или native: `npm start`.
5. Проверьте проект: `npm run ci`.

Expo подставляет переменные с префиксом `EXPO_PUBLIC_` в web и native-сборки. Не размещайте в клиентских переменных `service_role` key, пароли SmartShell или другие секреты.

## Supabase

Миграция находится в `supabase/migrations/202609220001_initial_schema.sql`.

Для локального Postgres нужен Docker Desktop:

```bash
npx supabase start
npx supabase db reset
```

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

В схеме есть индексы для запросов истории, неоплаченных отчётов и неоплаченных штрафов. Все таблицы используют RLS.

Важно: текущий клиент авторизуется в SmartShell, а не в Supabase Auth. Поэтому миграция содержит временные compatibility-политики с доступом `anon`; они сохраняют работу текущего клиента, но не обеспечивают изоляцию пользователей. Перед production нужно заменить их политиками на `auth.uid()` и перенести идентичность SmartShell в проверяемый серверный слой/edge function. `anon` key сам по себе не является секретом, но не должен использоваться как единственный механизм доступа к данным.

## Web / Netlify

Netlify собирает приложение командой `npm run build:web` и публикует `dist`. В настройках сайта добавьте:

- `EXPO_PUBLIC_SUPABASE_URL`;
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Маршрутизация SPA и базовые cache-заголовки находятся в `netlify.toml` и `web/_headers`.

## iOS / Android / EAS

Профили находятся в `eas.json`:

```bash
npx eas build --profile development
npx eas build --profile preview
npx eas build --profile production
npx eas submit --profile production
```

Для EAS создайте переменные окружения с теми же именами и подключите их к соответствующим профилям. Для production используйте отдельный Supabase-проект или отдельное окружение с независимыми ключами.

## CI/CD

`.github/workflows/ci.yml` выполняет `npm ci`, TypeScript-проверку и web-сборку для каждого pull request и push в `main`/`master`. `.github/workflows/eas-release.yml` запускает production-сборку iOS/Android вручную или по тегу `v*`; для него нужен secret `EXPO_TOKEN`. Деплой web выполняется Netlify после успешной сборки, если репозиторий подключён к Netlify.

Перед первым production-релизом необходимо:

- заменить compatibility RLS-политики на политики с реальной идентичностью пользователя;
- настроить отдельные Supabase-проекты для staging и production;
- добавить переменные окружения в Netlify и EAS;
- проверить резервное копирование и восстановление Supabase;
- включить мониторинг ошибок клиента и SmartShell-интеграции.
