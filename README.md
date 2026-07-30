This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase: библиотека и импорт

1. Создай проект в [Supabase](https://supabase.com/dashboard) и открой **Project Settings → API**.
2. В `.env.local` укажи значения проекта:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

3. Открой **SQL Editor** и последовательно выполни миграции:
	- [20260730_create_profiles.sql](supabase/migrations/20260730_create_profiles.sql)
	- [20260730_create_books.sql](supabase/migrations/20260730_create_books.sql)
4. Перезапусти приложение командой `npm run dev`, зарегистрируй или войди как `khodunalinaaa@gmail.com`.
5. На главной странице появится кнопка **Импортировать книги**. Она один раз прочитает [library.txt](library.txt) и добавит книги только в библиотеку этого аккаунта.

Отмеченные `✓` книги импортируются со статусом «Прочитано», а `◦` — «Не читано». У импортированных прочитанных книг могут отсутствовать оценка и отзыв: открой книгу, нажми «Редактировать книгу», добавь или исправь эти поля и сохрани. Повторное нажатие импорта не создаст дубликаты.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
