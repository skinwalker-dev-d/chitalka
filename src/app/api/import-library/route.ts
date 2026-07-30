import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const importSource = "library.txt:2026-07-30";
const allowedEmail = "khodunalinaaa@gmail.com";
const genres = new Set(["Сказки/Мифы", "Классика", "Профессиональная литература"]);
const collectionHeadings = new Set(["Английские коллекционные издания", "Фанфики"]);
const palette = [
  ["#b55c43", "#e7b89d"],
  ["#1f7068", "#b9dfd5"],
  ["#d79d37", "#f2dca9"],
  ["#6a5a99", "#d8cdea"],
  ["#385b8e", "#c7d8ed"],
] as const;

type ImportedBook = {
  title: string;
  author: string;
  genre: string;
  status: "Не читано" | "Прочитано";
  color: string;
  spine: string;
  initials: string;
  collections: string[];
  import_source: string;
};

function colorFor(title: string) {
  const index = [...title].reduce((total, character) => total + character.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function parseLibrary(source: string): ImportedBook[] {
  const books: ImportedBook[] = [];
  let author = "Не указан";
  let genre = "Без жанра";
  let collection = "";

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === "+") continue;
    const item = line.match(/^([✓◦])\s+(.+)$/);
    if (!item) {
      const heading = line.replace(/\s+\(\d+\)$/, "").trim();
      if (genres.has(heading)) {
        genre = heading;
        author = "Не указан";
        collection = "";
      } else if (collectionHeadings.has(heading)) {
        collection = heading;
      } else {
        author = heading;
        genre = "Без жанра";
        collection = "";
      }
      continue;
    }

    const status = item[1] === "✓" ? "Прочитано" : "Не читано";
    const entry = item[2].trim();
    const inlineAuthor = entry.match(/^(.*?)\s+\(([^()]+)\)$/);
    const title = (inlineAuthor?.[1] ?? entry).trim();
    const bookAuthor = (inlineAuthor?.[2] ?? author).trim() || "Не указан";
    const [color, spine] = colorFor(`${title}${bookAuthor}`);
    books.push({ title, author: bookAuthor, genre, status, color, spine, initials: title.slice(0, 2).toUpperCase(), collections: collection ? [collection] : [], import_source: importSource });
  }

  return books;
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== allowedEmail) return NextResponse.json({ error: "Импорт доступен только для целевого аккаунта." }, { status: 403 });

  const { count, error: countError } = await supabase.from("books").select("id", { count: "exact", head: true }).eq("import_source", importSource);
  if (countError) return NextResponse.json({ error: "Не удалось проверить предыдущий импорт." }, { status: 500 });
  if (count) return NextResponse.json({ imported: 0, message: "Этот файл уже импортирован." });

  const source = await readFile(path.join(process.cwd(), "library.txt"), "utf8");
  const books = parseLibrary(source);
  const { error } = await supabase.from("books").insert(books);
  if (error) return NextResponse.json({ error: "Не удалось сохранить книги в библиотеке." }, { status: 500 });

  return NextResponse.json({ imported: books.length, message: `Добавлено книг: ${books.length}.` });
}
