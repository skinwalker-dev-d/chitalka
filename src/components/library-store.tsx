"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type BookStatus = "Читаю" | "Не читано" | "Прочитано" | "Хочу купить";

export type Book = {
  id: number;
  title: string;
  author: string;
  description?: string;
  genre: string;
  status: BookStatus;
  completedAt?: string;
  rating?: number;
  review?: string;
  color: string;
  spine: string;
  initials: string;
  coverImage?: string;
  collections: string[];
};

export type ReadingGoal = { id: number; title: string; bookIds: number[] };
export type Shelf = { id: string; collectionId: string; name: string; bookIds: number[] };
export type LibraryCollection = { id: string; name: string; color?: string };

type LibraryStore = {
  books: Book[];
  collections: LibraryCollection[];
  goals: ReadingGoal[];
  genres: string[];
  addBook: (book: Omit<Book, "id">) => void;
  updateBook: (bookId: number, updates: Partial<Omit<Book, "id">>) => void;
  deleteBook: (bookId: number) => void;
  createCollection: (name: string, bookIds: number[], color?: string) => LibraryCollection | null;
  updateCollection: (collectionId: string, name: string, bookIds: number[], color?: string) => LibraryCollection | null;
  deleteCollection: (collectionId: string) => void;
  advanceStatus: (bookId: number) => void;
  addGoal: (title: string, bookIds: number[]) => void;
  updateGoal: (goalId: number, updates: Pick<ReadingGoal, "title" | "bookIds">) => void;
  removeGoal: (goalId: number) => void;
  addGenre: (name: string) => void;
  renameGenre: (oldName: string, newName: string) => void;
  deleteGenre: (name: string) => void;
  shelves: Shelf[];
  addShelf: (collectionId: string, name: string, bookIds: number[]) => void;
  updateShelf: (shelfId: string, name: string, bookIds: number[]) => void;
  deleteShelf: (shelfId: string) => void;
  reorderCollections: (orderedIds: string[]) => void;
  reorderGoals: (orderedIds: number[]) => void;
  reorderGenres: (orderedNames: string[]) => void;
};

const initialBooks: Book[] = [
  { id: 1, title: "Мастер и Маргарита", author: "Михаил Булгаков", genre: "Классика", status: "Читаю", rating: 5, color: "#b55c43", spine: "#e7b89d", initials: "ММ", collections: ["Ноябрьское чтение", "Классика"] },
  { id: 2, title: "Семь мужей Эвелин Хьюго", author: "Тейлор Дженкинс Рид", genre: "Роман", status: "Не читано", color: "#1f7068", spine: "#b9dfd5", initials: "СМ", collections: ["Ноябрьское чтение"] },
  { id: 3, title: "Властелин колец", author: "Дж. Р. Р. Толкин", genre: "Фэнтези", status: "Прочитано", rating: 5, color: "#d79d37", spine: "#f2dca9", initials: "ВК", collections: ["Любимые"] },
  { id: 4, title: "Пикник на обочине", author: "Аркадий и Борис Стругацкие", genre: "Фантастика", status: "Не читано", color: "#6a5a99", spine: "#d8cdea", initials: "ПО", collections: ["Ноябрьское чтение"] },
  { id: 5, title: "Завет воды", author: "Абрахам Вергезе", genre: "Современная проза", status: "Хочу купить", color: "#385b8e", spine: "#c7d8ed", initials: "ЗВ", collections: ["Хочу купить"] },
];
const LibraryContext = createContext<LibraryStore | null>(null);

function collectNames(books: Book[]): LibraryCollection[] {
  return Array.from(new Set(books.flatMap((book) => book.collections)))
    .sort((first, second) => first.localeCompare(second, "ru"))
    .map((name) => ({ id: `collection-${name.toLocaleLowerCase("ru").replace(/[^a-zа-яё0-9]+/gi, "-")}`, name }));
}

export function getGoalProgress(goal: ReadingGoal, books: Book[]) {
  const selectedBooks = books.filter((book) => goal.bookIds.includes(book.id));
  return { completed: selectedBooks.filter((book) => book.status === "Прочитано").length, total: selectedBooks.length };
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState(() => collectNames(initialBooks));
  const [goals, setGoals] = useState<ReadingGoal[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);

  useEffect(() => {
    let isActive = true;
    async function hydrateLibrary() {
      try {
        const supabase = createSupabaseBrowserClient();
        // All queries in parallel; cover_image excluded for fast first paint
        const [
          { data: booksData, error: booksError },
          { data: collectionsData },
          { data: goalsData },
          { data: genresData },
          { data: shelvesData },
        ] = await Promise.all([
          supabase.from("books").select("id, title, author, description, genre, status, completed_at, rating, review, color, spine, initials, collections, created_at").order("created_at", { ascending: false }),
          supabase.from("collections").select("id, name, color, position").order("position", { ascending: true }),
          supabase.from("goals").select("id, title, book_ids").order("position", { ascending: true }),
          supabase.from("genres").select("name").order("position", { ascending: true }),
          supabase.from("shelves").select("id, collection_id, name, book_ids").order("name"),
        ]);
        if (booksError) throw booksError;
        if (!isActive) return;
        const storedBooks = (booksData as unknown as StoredBook[]).map(fromStoredBook);
        setBooks(storedBooks);
        if (collectionsData && collectionsData.length > 0) {
          const validCollections = collectionsData as LibraryCollection[];
          setCollections(validCollections);
          // Reconcile: strip book.collections references that have no matching row in the DB
          const validNames = new Set(validCollections.map((c) => c.name));
          const booksToFix = storedBooks.filter((b) => b.collections.some((n) => !validNames.has(n)));
          if (booksToFix.length > 0 && isActive) {
            const fixed = booksToFix.map((b) => ({ ...b, collections: b.collections.filter((n) => validNames.has(n)) }));
            setBooks((prev) => prev.map((b) => fixed.find((f) => f.id === b.id) ?? b));
            fixed.forEach((b) => void supabase.from("books").update({ collections: b.collections }).eq("id", b.id)
              .then(({ error }) => { if (error) console.error("[reconcile collections] book update failed:", error); }));
          }
        } else {
          // Seed collections from existing books on first migration
          const seeded = collectNames(storedBooks);
          setCollections(seeded);
          if (seeded.length > 0) void supabase.from("collections").insert(seeded.map((c) => ({ id: c.id, name: c.name })));
        }
        if (isActive) setGoals((goalsData ?? []).map(fromStoredGoal));
        if (isActive) setGenres((genresData ?? []).map((g: { name: string }) => g.name));
        if (isActive) setShelves((shelvesData ?? []).map((s) => fromStoredShelf(s as StoredShelf)));
        // Load cover images in small batches to avoid statement timeout on large libraries
        if (isActive && storedBooks.length > 0) {
          const BATCH = 5;
          const ids = storedBooks.filter((b) => b.coverImage === undefined).map((b) => b.id);
          const loadBatch = async (offset: number) => {
            if (!isActive || offset >= ids.length) return;
            const batch = ids.slice(offset, offset + BATCH);
            const { data: covers, error } = await supabase.from("books").select("id, cover_image").in("id", batch);
            if (!isActive) return;
            if (!error && covers) {
              setBooks((current) => current.map((book) => {
                const c = (covers as { id: number; cover_image: string | null }[]).find((r) => r.id === book.id);
                return c?.cover_image ? { ...book, coverImage: c.cover_image } : book;
              }));
            }
            window.setTimeout(() => void loadBatch(offset + BATCH), 300);
          };
          void loadBatch(0);
        }
      } catch {
        if (!isActive) return;
        setCollections([]);
      }
    }
    void hydrateLibrary();
    return () => { isActive = false; };
  }, []);

  function addBook(book: Omit<Book, "id">) {
    const pendingBook = { ...book, completedAt: book.status === "Прочитано" ? book.completedAt ?? new Date().toISOString() : undefined, id: Date.now() };
    setBooks((current) => [pendingBook, ...current]);
    void createSupabaseBrowserClient().from("books").insert(toStoredBook(pendingBook)).select().single().then(({ data }) => {
      if (data) setBooks((current) => current.map((currentBook) => currentBook.id === pendingBook.id ? fromStoredBook(data as StoredBook) : currentBook));
    });
  }
  function updateBook(bookId: number, updates: Partial<Omit<Book, "id">>) {
    const book = books.find((currentBook) => currentBook.id === bookId);
    if (!book) return;
    const status = updates.status ?? book.status;
    // Only stamp completedAt when transitioning INTO "Прочитано"; preserve existing value (or undefined) otherwise
    const transitioningToRead = status === "Прочитано" && book.status !== "Прочитано";
    const completedAt = status === "Прочитано"
      ? (transitioningToRead ? (book.completedAt ?? updates.completedAt ?? new Date().toISOString()) : book.completedAt)
      : undefined;
    const updatedBook = { ...book, ...updates, completedAt };
    setBooks((current) => current.map((currentBook) => currentBook.id === bookId ? updatedBook : currentBook));
    void createSupabaseBrowserClient().from("books").update(toStoredBook(updatedBook)).eq("id", bookId).then(({ error }) => { if (error) console.error("[updateBook] failed:", error); });
  }
  function deleteBook(bookId: number) {
    const book = books.find((b) => b.id === bookId);
    setBooks((current) => current.filter((b) => b.id !== bookId));
    void createSupabaseBrowserClient().from("books").delete().eq("id", bookId).then(({ error }) => {
      if (error) {
        console.error("[deleteBook] failed:", error);
        if (book) setBooks((current) => [book, ...current]);
      }
    });
  }
  function createCollection(name: string, bookIds: number[], color?: string) {
    const trimmedName = name.trim();
    if (!trimmedName || collections.some((collection) => collection.name.localeCompare(trimmedName, "ru", { sensitivity: "accent" }) === 0)) return null;
    // crypto.randomUUID requires secure context; fall back to Math.random for HTTP dev
    const uuid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const collection = { id: uuid, name: trimmedName, color: color || undefined };
    setCollections((current) => [...current, collection]);
    const sb = createSupabaseBrowserClient();
    void sb.from("collections").insert({ id: collection.id, name: trimmedName, color: color || null, position: collections.length }).then(({ error }) => { if (error) console.error("[collections] insert failed:", error); });
    const updatedBooks = books.map((book) => bookIds.includes(book.id) && !book.collections.includes(trimmedName) ? { ...book, collections: [...book.collections, trimmedName] } : book);
    setBooks(updatedBooks);
    updatedBooks.filter((book) => bookIds.includes(book.id)).forEach((book) => { void sb.from("books").update(toStoredBook(book)).eq("id", book.id).then(({ error }) => { if (error) console.error(`[createCollection] book ${book.id} update failed:`, error); }); });
    return collection;
  }
  function updateCollection(collectionId: string, name: string, bookIds: number[], color?: string) {
    const collection = collections.find((current) => current.id === collectionId);
    const trimmedName = name.trim();
    if (!collection || !trimmedName || collections.some((current) => current.id !== collectionId && current.name.localeCompare(trimmedName, "ru", { sensitivity: "accent" }) === 0)) return null;
    const updatedCollection = { ...collection, name: trimmedName, color: color !== undefined ? (color || undefined) : collection.color };
    const updatedBooks = books.map((book) => {
      const withoutCollection = book.collections.filter((current) => current !== collection.name);
      return bookIds.includes(book.id) ? { ...book, collections: [...withoutCollection, trimmedName] } : { ...book, collections: withoutCollection };
    });
    setCollections((current) => current.map((currentCollection) => currentCollection.id === collectionId ? updatedCollection : currentCollection));
    setBooks(updatedBooks);
    const sb = createSupabaseBrowserClient();
    void sb.from("collections").update({ name: trimmedName, color: updatedCollection.color || null }).eq("id", collectionId).then(({ error }) => { if (error) console.error("[updateCollection] rename failed:", error); });
    updatedBooks.filter((book, index) => book.collections.join("\u0000") !== books[index].collections.join("\u0000")).forEach((book) => { void sb.from("books").update(toStoredBook(book)).eq("id", book.id).then(({ error }) => { if (error) console.error(`[updateCollection] book ${book.id} update failed:`, error); }); });
    return updatedCollection;
  }
  function deleteCollection(collectionId: string) {
    const collection = collections.find((current) => current.id === collectionId);
    if (!collection) return;
    const updatedBooks = books.map((book) => ({ ...book, collections: book.collections.filter((current) => current !== collection.name) }));
    setCollections((current) => current.filter((currentCollection) => currentCollection.id !== collectionId));
    setBooks(updatedBooks);
    setShelves((current) => current.filter((shelf) => shelf.collectionId !== collectionId));
    const sb = createSupabaseBrowserClient();
    void sb.from("collections").delete().eq("id", collection.id).then(({ error }) => { if (error) console.error("[deleteCollection] failed:", error); });
    updatedBooks.filter((book, index) => book.collections.length !== books[index].collections.length).forEach((book) => { void sb.from("books").update(toStoredBook(book)).eq("id", book.id).then(({ error }) => { if (error) console.error(`[deleteCollection] book ${book.id} update failed:`, error); }); });
  }
  function advanceStatus(bookId: number) {
    const next: Record<BookStatus, BookStatus> = { "Не читано": "Читаю", Читаю: "Прочитано", Прочитано: "Не читано", "Хочу купить": "Не читано" };
    const book = books.find((currentBook) => currentBook.id === bookId);
    if (!book || (book.status === "Читаю" && (!book.rating || !book.review?.trim()))) return;
    updateBook(bookId, { status: next[book.status] });
  }
  function addGoal(title: string, bookIds: number[]) {
    const pendingId = Date.now();
    setGoals((current) => [{ id: pendingId, title, bookIds }, ...current]);
    void createSupabaseBrowserClient().from("goals").insert({ title, book_ids: bookIds, position: goals.length }).select("id, title, book_ids").single().then(({ data }) => {
      if (data) setGoals((current) => current.map((goal) => goal.id === pendingId ? fromStoredGoal(data as StoredGoal) : goal));
    });
  }
  function updateGoal(goalId: number, updates: Pick<ReadingGoal, "title" | "bookIds">) {
    setGoals((current) => current.map((goal) => goal.id === goalId ? { ...goal, ...updates } : goal));
    void createSupabaseBrowserClient().from("goals").update({ title: updates.title, book_ids: updates.bookIds }).eq("id", goalId);
  }
  function removeGoal(goalId: number) {
    const goal = goals.find((g) => g.id === goalId);
    setGoals((current) => current.filter((g) => g.id !== goalId));
    void createSupabaseBrowserClient().from("goals").delete().eq("id", goalId).then(({ error }) => {
      if (error) { console.error("[removeGoal] failed:", error); if (goal) setGoals((current) => [...current, goal]); }
    });
  }
  function addGenre(name: string) {
    const trimmed = name.trim();
    if (!trimmed || genres.some((g) => g.localeCompare(trimmed, "ru", { sensitivity: "accent" }) === 0)) return;
    setGenres((current) => [...current, trimmed]);
    const sb = createSupabaseBrowserClient();
    void sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void sb.from("genres").upsert({ name: trimmed, user_id: user.id, position: genres.length }).then(({ error }) => { if (error) console.error("[addGenre] failed:", error); });
    });
  }
  function renameGenre(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setGenres((current) => current.map((g) => g === oldName ? trimmed : g));
    const updatedBooks = books.map((book) => book.genre === oldName ? { ...book, genre: trimmed } : book);
    setBooks(updatedBooks);
    const sb = createSupabaseBrowserClient();
    void sb.from("genres").update({ name: trimmed }).eq("name", oldName).then(({ error }) => { if (error) console.error("[renameGenre] genres failed:", error); });
    void sb.from("books").update({ genre: trimmed }).eq("genre", oldName).then(({ error }) => { if (error) console.error("[renameGenre] books failed:", error); });
  }
  function deleteGenre(name: string) {
    setGenres((current) => current.filter((g) => g !== name));
    const updatedBooks = books.map((book) => book.genre === name ? { ...book, genre: "" } : book);
    setBooks(updatedBooks);
    const sb = createSupabaseBrowserClient();
    void sb.from("genres").delete().eq("name", name).then(({ error }) => { if (error) console.error("[deleteGenre] genres failed:", error); });
    void sb.from("books").update({ genre: "" }).eq("genre", name).then(({ error }) => { if (error) console.error("[deleteGenre] books failed:", error); });
  }

  function addShelf(collectionId: string, name: string, bookIds: number[]) {
    const pendingId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `pending-${Date.now()}`;
    const pending: Shelf = { id: pendingId, collectionId, name, bookIds };
    setShelves((current) => [...current, pending]);
    const sb = createSupabaseBrowserClient();
    void sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void sb.from("shelves").insert({ collection_id: collectionId, name, book_ids: bookIds, user_id: user.id }).select("id, collection_id, name, book_ids").single().then(({ data, error }) => {
        if (error) { console.error("[addShelf] failed:", error); setShelves((current) => current.filter((s) => s.id !== pendingId)); return; }
        if (data) setShelves((current) => current.map((s) => s.id === pendingId ? fromStoredShelf(data as StoredShelf) : s));
      });
    });
  }
  function updateShelf(shelfId: string, name: string, bookIds: number[]) {
    setShelves((current) => current.map((s) => s.id === shelfId ? { ...s, name, bookIds } : s));
    void createSupabaseBrowserClient().from("shelves").update({ name, book_ids: bookIds }).eq("id", shelfId).then(({ error }) => { if (error) console.error("[updateShelf] failed:", error); });
  }
  function deleteShelf(shelfId: string) {
    const shelf = shelves.find((s) => s.id === shelfId);
    setShelves((current) => current.filter((s) => s.id !== shelfId));
    void createSupabaseBrowserClient().from("shelves").delete().eq("id", shelfId).then(({ error }) => { if (error) { console.error("[deleteShelf] failed:", error); if (shelf) setShelves((current) => [...current, shelf]); } });
  }

  function reorderCollections(orderedIds: string[]) {
    setCollections((current) => orderedIds.map((id) => current.find((c) => c.id === id)!).filter(Boolean));
    const sb = createSupabaseBrowserClient();
    orderedIds.forEach((id, i) => void sb.from("collections").update({ position: i }).eq("id", id).then(({ error }) => { if (error) console.error("[reorderCollections] failed:", error); }));
  }
  function reorderGoals(orderedIds: number[]) {
    setGoals((current) => orderedIds.map((id) => current.find((g) => g.id === id)!).filter(Boolean));
    const sb = createSupabaseBrowserClient();
    orderedIds.forEach((id, i) => void sb.from("goals").update({ position: i }).eq("id", id).then(({ error }) => { if (error) console.error("[reorderGoals] failed:", error); }));
  }
  function reorderGenres(orderedNames: string[]) {
    setGenres(orderedNames);
    const sb = createSupabaseBrowserClient();
    void sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      orderedNames.forEach((name, i) => void sb.from("genres").upsert({ name, user_id: user.id, position: i }, { onConflict: "user_id,name" }).then(({ error }) => { if (error) console.error("[reorderGenres] failed:", error); }));
    });
  }

  return <LibraryContext value={{ books, collections, goals, genres, shelves, addBook, updateBook, deleteBook, createCollection, updateCollection, deleteCollection, advanceStatus, addGoal, updateGoal, removeGoal, addGenre, renameGenre, deleteGenre, addShelf, updateShelf, deleteShelf, reorderCollections, reorderGoals, reorderGenres }}>{children}</LibraryContext>;
}

export function useLibrary() {
  const store = useContext(LibraryContext);
  if (!store) throw new Error("useLibrary must be used inside LibraryProvider");
  return store;
}

type StoredBook = { id: number; title: string; author: string; description: string | null; genre: string; status: BookStatus; completed_at: string | null; rating: number | null; review: string | null; color: string; spine: string; initials: string; cover_image: string | null; collections: string[] | null };

function fromStoredBook(book: StoredBook): Book {
  return { id: book.id, title: book.title, author: book.author, description: book.description ?? undefined, genre: book.genre, status: book.status, completedAt: book.completed_at ?? undefined, rating: book.rating ?? undefined, review: book.review ?? undefined, color: book.color, spine: book.spine, initials: book.initials, coverImage: book.cover_image ?? undefined, collections: book.collections ?? [] };
}

function toStoredBook(book: Omit<Book, "id">) {
  return { title: book.title, author: book.author, description: book.description ?? null, genre: book.genre, status: book.status, completed_at: book.completedAt ?? null, rating: book.rating ?? null, review: book.review ?? null, color: book.color, spine: book.spine, initials: book.initials, cover_image: book.coverImage ?? null, collections: book.collections };
}

type StoredGoal = { id: number; title: string; book_ids: number[] };

function fromStoredGoal(goal: StoredGoal): ReadingGoal {
  return { id: goal.id, title: goal.title, bookIds: goal.book_ids };
}

type StoredShelf = { id: string; collection_id: string; name: string; book_ids: number[] | null };

function fromStoredShelf(s: StoredShelf): Shelf {
  return { id: s.id, collectionId: s.collection_id, name: s.name, bookIds: s.book_ids ?? [] };
}