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
export type LibraryCollection = { id: string; name: string };

type LibraryStore = {
  books: Book[];
  collections: LibraryCollection[];
  goals: ReadingGoal[];
  addBook: (book: Omit<Book, "id">) => void;
  updateBook: (bookId: number, updates: Partial<Omit<Book, "id">>) => void;
  deleteBook: (bookId: number) => void;
  createCollection: (name: string, bookIds: number[]) => LibraryCollection | null;
  updateCollection: (collectionId: string, name: string, bookIds: number[]) => LibraryCollection | null;
  deleteCollection: (collectionId: string) => void;
  advanceStatus: (bookId: number) => void;
  addGoal: (title: string, bookIds: number[]) => void;
  updateGoal: (goalId: number, updates: Pick<ReadingGoal, "title" | "bookIds">) => void;
  removeGoal: (goalId: number) => void;
};

const collectionsKey = "listat-collections-v1";
const goalsKey = "listat-reading-goals-v1";
const initialBooks: Book[] = [
  { id: 1, title: "Мастер и Маргарита", author: "Михаил Булгаков", genre: "Классика", status: "Читаю", rating: 5, color: "#b55c43", spine: "#e7b89d", initials: "ММ", collections: ["Ноябрьское чтение", "Классика"] },
  { id: 2, title: "Семь мужей Эвелин Хьюго", author: "Тейлор Дженкинс Рид", genre: "Роман", status: "Не читано", color: "#1f7068", spine: "#b9dfd5", initials: "СМ", collections: ["Ноябрьское чтение"] },
  { id: 3, title: "Властелин колец", author: "Дж. Р. Р. Толкин", genre: "Фэнтези", status: "Прочитано", rating: 5, color: "#d79d37", spine: "#f2dca9", initials: "ВК", collections: ["Любимые"] },
  { id: 4, title: "Пикник на обочине", author: "Аркадий и Борис Стругацкие", genre: "Фантастика", status: "Не читано", color: "#6a5a99", spine: "#d8cdea", initials: "ПО", collections: ["Ноябрьское чтение"] },
  { id: 5, title: "Завет воды", author: "Абрахам Вергезе", genre: "Современная проза", status: "Хочу купить", color: "#385b8e", spine: "#c7d8ed", initials: "ЗВ", collections: ["Хочу купить"] },
];
const initialGoals: ReadingGoal[] = [{ id: 1, title: "Ноябрьское чтение", bookIds: [1, 2, 4] }];
const LibraryContext = createContext<LibraryStore | null>(null);

function collectNames(books: Book[]): LibraryCollection[] {
  return Array.from(new Set(books.flatMap((book) => book.collections)))
    .sort((first, second) => first.localeCompare(second, "ru"))
    .map((name) => ({ id: `collection-${name.toLocaleLowerCase("ru").replace(/[^a-zа-яё0-9]+/gi, "-")}`, name }));
}

function readStored<T>(key: string): T[] | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return Array.isArray(value) ? value as T[] : null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function migrateGoals(goals: unknown[], books: Book[]): ReadingGoal[] {
  return goals.flatMap((goal) => {
    if (!goal || typeof goal !== "object" || !("id" in goal) || !("title" in goal)) return [];
    const record = goal as { id: unknown; title: unknown; bookIds?: unknown };
    if (typeof record.id !== "number" || typeof record.title !== "string") return [];
    const bookIds = Array.isArray(record.bookIds) ? record.bookIds.filter((id): id is number => typeof id === "number" && books.some((book) => book.id === id)) : [];
    return [{ id: record.id, title: record.title, bookIds }];
  });
}

export function getGoalProgress(goal: ReadingGoal, books: Book[]) {
  const selectedBooks = books.filter((book) => goal.bookIds.includes(book.id));
  return { completed: selectedBooks.filter((book) => book.status === "Прочитано").length, total: selectedBooks.length };
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState(() => collectNames(initialBooks));
  const [goals, setGoals] = useState(initialGoals);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isActive = true;
    async function hydrateLibrary() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.from("books").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        if (!isActive) return;
        const storedBooks = (data as StoredBook[]).map(fromStoredBook);
        setBooks(storedBooks);
        setCollections(readStored<LibraryCollection>(collectionsKey) ?? collectNames(storedBooks));
        const storedGoals = readStored<unknown>(goalsKey);
        setGoals(storedGoals ? migrateGoals(storedGoals, storedBooks) : initialGoals);
      } catch {
        if (!isActive) return;
        setCollections([]);
        setGoals([]);
      } finally {
        if (isActive) setIsHydrated(true);
      }
    }
    void hydrateLibrary();
    return () => { isActive = false; };
  }, []);

  useEffect(() => { if (isHydrated) window.localStorage.setItem(collectionsKey, JSON.stringify(collections)); }, [collections, isHydrated]);
  useEffect(() => { if (isHydrated) window.localStorage.setItem(goalsKey, JSON.stringify(goals)); }, [goals, isHydrated]);

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
    const updatedBook = { ...book, ...updates, completedAt: status === "Прочитано" ? book.completedAt ?? updates.completedAt ?? new Date().toISOString() : undefined };
    setBooks((current) => current.map((currentBook) => currentBook.id === bookId ? updatedBook : currentBook));
    void createSupabaseBrowserClient().from("books").update(toStoredBook(updatedBook)).eq("id", bookId);
  }
  function deleteBook(bookId: number) {
    setBooks((current) => current.filter((book) => book.id !== bookId));
    void createSupabaseBrowserClient().from("books").delete().eq("id", bookId);
  }
  function createCollection(name: string, bookIds: number[]) {
    const trimmedName = name.trim();
    if (!trimmedName || collections.some((collection) => collection.name.localeCompare(trimmedName, "ru", { sensitivity: "accent" }) === 0)) return null;
    const collection = { id: crypto.randomUUID(), name: trimmedName };
    setCollections((current) => [...current, collection]);
    const updatedBooks = books.map((book) => bookIds.includes(book.id) && !book.collections.includes(trimmedName) ? { ...book, collections: [...book.collections, trimmedName] } : book);
    setBooks(updatedBooks);
    updatedBooks.filter((book) => bookIds.includes(book.id)).forEach((book) => { void createSupabaseBrowserClient().from("books").update(toStoredBook(book)).eq("id", book.id); });
    return collection;
  }
  function updateCollection(collectionId: string, name: string, bookIds: number[]) {
    const collection = collections.find((current) => current.id === collectionId);
    const trimmedName = name.trim();
    if (!collection || !trimmedName || collections.some((current) => current.id !== collectionId && current.name.localeCompare(trimmedName, "ru", { sensitivity: "accent" }) === 0)) return null;
    const updatedCollection = { ...collection, name: trimmedName };
    const updatedBooks = books.map((book) => {
      const withoutCollection = book.collections.filter((current) => current !== collection.name);
      return bookIds.includes(book.id) ? { ...book, collections: [...withoutCollection, trimmedName] } : { ...book, collections: withoutCollection };
    });
    setCollections((current) => current.map((currentCollection) => currentCollection.id === collectionId ? updatedCollection : currentCollection));
    setBooks(updatedBooks);
    updatedBooks.filter((book, index) => book.collections.join("\u0000") !== books[index].collections.join("\u0000")).forEach((book) => { void createSupabaseBrowserClient().from("books").update(toStoredBook(book)).eq("id", book.id); });
    return updatedCollection;
  }
  function deleteCollection(collectionId: string) {
    const collection = collections.find((current) => current.id === collectionId);
    if (!collection) return;
    const updatedBooks = books.map((book) => ({ ...book, collections: book.collections.filter((current) => current !== collection.name) }));
    setCollections((current) => current.filter((currentCollection) => currentCollection.id !== collectionId));
    setBooks(updatedBooks);
    updatedBooks.filter((book, index) => book.collections.length !== books[index].collections.length).forEach((book) => { void createSupabaseBrowserClient().from("books").update(toStoredBook(book)).eq("id", book.id); });
  }
  function advanceStatus(bookId: number) {
    const next: Record<BookStatus, BookStatus> = { "Не читано": "Читаю", Читаю: "Прочитано", Прочитано: "Не читано", "Хочу купить": "Не читано" };
    const book = books.find((currentBook) => currentBook.id === bookId);
    if (!book || (book.status === "Читаю" && (!book.rating || !book.review?.trim()))) return;
    updateBook(bookId, { status: next[book.status] });
  }
  function addGoal(title: string, bookIds: number[]) { setGoals((current) => [{ id: Date.now(), title, bookIds }, ...current]); }
  function updateGoal(goalId: number, updates: Pick<ReadingGoal, "title" | "bookIds">) { setGoals((current) => current.map((goal) => goal.id === goalId ? { ...goal, ...updates } : goal)); }
  function removeGoal(goalId: number) { setGoals((current) => current.filter((goal) => goal.id !== goalId)); }

  return <LibraryContext value={{ books, collections, goals, addBook, updateBook, deleteBook, createCollection, updateCollection, deleteCollection, advanceStatus, addGoal, updateGoal, removeGoal }}>{children}</LibraryContext>;
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