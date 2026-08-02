"use client";

import {
  BookOpen,
  Check,
  ChevronDown,
  CirclePlus,
  Compass,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { ChangeEvent, FormEvent, useDeferredValue, useEffect, useRef, useState } from "react";
import { Book, BookStatus, getGoalProgress, LibraryCollection, ReadingGoal, Shelf, useLibrary } from "@/components/library-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SortableGrid, SortableItem, useLongPress } from "@/components/sortable-grid";
import { arrayMove } from "@dnd-kit/sortable";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

const filters: Array<BookStatus | "Все"> = ["Все", "Читаю", "Не читано", "Прочитано", "Хочу купить"];
const statusClass: Record<BookStatus, string> = { Читаю: "status-reading", "Не читано": "status-unread", Прочитано: "status-read", "Хочу купить": "status-wishlist" };

type FlightStyle = React.CSSProperties & {
  "--flight-x": string;
  "--flight-y": string;
  "--form-width": string;
  "--form-height": string;
  "--flight-width": string;
  "--flight-height": string;
  "--flight-color": string;
};

function PageHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</section>;
}

function ReadReviewModal({ book, onClose, onComplete }: { book: Book; onClose: () => void; onComplete: (rating: number, review: string) => void }) {
  const [rating, setRating] = useState(book.rating ?? 0);
  const [review, setReview] = useState(book.review ?? "");
  const [error, setError] = useState("");
  function submitReview(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!rating || !review.trim()) { setError("Поставь оценку и напиши отзыв, чтобы отметить книгу прочитанной."); return; } onComplete(rating, review.trim()); }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="book-composer read-review-composer" onSubmit={submitReview} onMouseDown={(event) => event.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">После прочтения</p><h2>Твои впечатления</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></div><p className="review-book-title">{book.title}</p><fieldset className="rating-picker"><legend>Оценка</legend><div>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button type="button" className={rating >= value ? "active" : ""} onClick={() => setRating(value)} aria-label={`Оценка ${value} из 10`} key={value}><Star size={18} fill="currentColor" /></button>)}</div><small>{rating ? `${rating} из 10` : "Выбери оценку"}</small></fieldset><label>Ревью<textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="Что запомнилось, удивило или зацепило?" maxLength={1000} /></label>{error && <p className="review-error" role="alert">{error}</p>}<button className="submit-button" type="submit">Отметить прочитанной</button></form></div>;
}

function BookDetailsModal({ book, onClose, onAdvanceStatus, onRequestRead, onDelete }: { book: Book; onClose: () => void; onEdit?: () => void; onAdvanceStatus: () => void; onRequestRead?: () => void; onDelete?: (book: Book) => void }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const { updateBook, deleteBook } = useLibrary();
  if (isEditorOpen) return <CollectionBookEditor book={book} onClose={onClose} />;
  if (isReviewOpen) return <ReadReviewModal book={book} onClose={() => setIsReviewOpen(false)} onComplete={(rating, review) => { updateBook(book.id, { status: "Прочитано", rating, review }); onClose(); }} />;
  return <><div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="book-details-modal" role="dialog" aria-modal="true" aria-labelledby="book-details-title" onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="icon-button details-close" onClick={onClose} aria-label="Закрыть">×</button>
      <div className="details-cover" style={{ "--cover": book.color, "--spine": book.spine } as React.CSSProperties}>
        {book.coverImage && <Image src={book.coverImage} alt={`Обложка: ${book.title}`} fill unoptimized sizes="(max-width: 680px) 66vw, 280px" />}
        {!book.coverImage && <><span>{book.initials}</span><strong>{book.title}</strong></>}
      </div>
      <div className="details-content">
        <p className="eyebrow">{book.genre}</p><h2 id="book-details-title">{book.title}</h2><p className="details-author">{book.author}</p>
        <div className="details-status-row"><span className={`status ${statusClass[book.status]}`}>{book.status === "Прочитано" && <Check size={13} />}{book.status}</span><button type="button" className="status-change" onClick={book.status === "Читаю" ? (onRequestRead ?? (() => setIsReviewOpen(true))) : onAdvanceStatus}>{book.status === "Читаю" ? "Закончить книгу" : "Сменить статус"}</button></div>
        {book.description ? <p className="details-description">{book.description}</p> : <p className="details-description muted">Описание пока не добавлено.</p>}
        <div className="details-collections"><strong>Коллекции</strong><div>{book.collections.length ? book.collections.map((collection) => <span key={collection}>{collection}</span>) : <em>Не добавлена в коллекции</em>}</div></div>
        {book.rating && <p className="details-rating">Оценка: <strong>{book.rating}</strong></p>}
        {book.review && <p className="details-review">{book.review}</p>}
        <button type="button" className="submit-button" onClick={() => setIsEditorOpen(true)}><Pencil size={17} /> Редактировать книгу</button>
        <button type="button" className="delete-button" onClick={() => setIsDeleteConfirmationOpen(true)}><Trash2 size={17} /> Удалить книгу</button>
      </div>
    </section>
  </div>{isDeleteConfirmationOpen && <div className="modal-backdrop confirmation-backdrop" role="presentation" onMouseDown={() => setIsDeleteConfirmationOpen(false)}><section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-book-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">Удаление книги</p><h2 id="delete-book-title">Ты действительно хочешь избавиться от этого маленького кусочка истории?</h2><div className="confirmation-actions"><button type="button" className="confirmation-cancel" onClick={() => setIsDeleteConfirmationOpen(false)}>Отменить</button><button type="button" className="confirmation-delete" onClick={() => { if (onDelete) onDelete(book); else deleteBook(book.id); onClose(); }}>Удалить</button></div></section></div>}</>;
}

function CollectionBookEditor({ book, onClose }: { book: Book; onClose: () => void }) {
  const { books, collections, updateBook } = useLibrary();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [genre, setGenre] = useState(book.genre);
  const genreOptions = [...new Set(["Без жанра", ...books.map((b) => b.genre).filter(Boolean)])].sort((a, b) => a === "Без жанра" ? -1 : b === "Без жанра" ? 1 : a.localeCompare(b, "ru"));
  const [description, setDescription] = useState(book.description ?? "");
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [rating, setRating] = useState(book.rating ?? 0);
  const [review, setReview] = useState(book.review ?? "");
  const [selectedCollections, setSelectedCollections] = useState(book.collections);
  const [coverImage, setCoverImage] = useState<string | null>(book.coverImage ?? null);
  const [coverError, setCoverError] = useState("");
  const [isCollectionMenuOpen, setIsCollectionMenuOpen] = useState(false);
  const [isCollectionMenuUp, setIsCollectionMenuUp] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isStatusMenuUp, setIsStatusMenuUp] = useState(false);
  const [isGenreMenuOpen, setIsGenreMenuOpen] = useState(false);
  const [isGenreMenuUp, setIsGenreMenuUp] = useState(false);
  const [isNewGenreOpen, setIsNewGenreOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");

  function selectCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 6 * 1024 * 1024) { setCoverError("Размер обложки не должен превышать 6 МБ."); return; }
    const reader = new FileReader();
    reader.onload = () => { setCoverImage(typeof reader.result === "string" ? reader.result : null); setCoverError(""); };
    reader.readAsDataURL(file);
  }
  function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !author.trim()) return;
    if (status === "Прочитано" && book.status !== "Прочитано" && (!rating || !review.trim())) { window.alert("Чтобы отметить книгу прочитанной, добавь оценку и ревью."); return; }
    updateBook(book.id, { title: title.trim(), author: author.trim(), description: description.trim() || undefined, genre: genre || "Без жанра", status, rating: rating || undefined, review: review.trim() || undefined, initials: title.trim().slice(0, 2).toUpperCase(), coverImage: coverImage ?? undefined, collections: selectedCollections });
    onClose();
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="book-composer" onSubmit={saveBook} onMouseDown={(event) => event.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">Твоя книга</p><h2>Редактировать книгу</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></div><label>Название<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Автор<input value={author} onChange={(event) => setAuthor(event.target.value)} /></label><div className="collection-field"><span>Жанр</span><button type="button" className="collection-trigger" onClick={(event) => { const b = event.currentTarget.getBoundingClientRect(); setIsGenreMenuUp(window.innerHeight - b.bottom < 210); setIsGenreMenuOpen((open) => !open); }} aria-expanded={isGenreMenuOpen}><span>{genre}</span><ChevronDown size={18} /></button>{isGenreMenuOpen && <div className={isGenreMenuUp ? "collection-menu opens-up" : "collection-menu"}><button className="create-collection-option" type="button" onClick={() => setIsNewGenreOpen(true)}><Plus size={16} /> Добавить жанр</button><div className="collection-options">{genreOptions.map((g) => <label key={g}><input type="radio" name="editor-genre" checked={g === genre} onChange={() => { setGenre(g); setIsGenreMenuOpen(false); }} /><span>{g}</span></label>)}</div></div>}{isNewGenreOpen && <div className="new-collection-row"><input autoFocus value={newGenreName} onChange={(event) => setNewGenreName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (newGenreName.trim()) { setGenre(newGenreName.trim()); setNewGenreName(""); setIsNewGenreOpen(false); setIsGenreMenuOpen(false); } } }} placeholder="Название жанра" /><button type="button" onClick={() => { if (newGenreName.trim()) { setGenre(newGenreName.trim()); setNewGenreName(""); setIsNewGenreOpen(false); setIsGenreMenuOpen(false); } }}>Добавить</button></div>}</div><label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label><div className="cover-upload"><span>Обложка</span>{coverImage ? <div className="cover-preview"><Image src={coverImage} alt="Предпросмотр обложки" width={52} height={70} unoptimized /><div><strong>Обложка выбрана</strong><button type="button" onClick={() => setCoverImage(null)}><X size={15} /> Удалить</button></div></div> : <label className="cover-upload-trigger"><ImagePlus size={20} /><span>Загрузить обложку</span><small>Фото или изображение до 2 МБ</small><input type="file" accept="image/*" onChange={selectCover} /></label>}{coverError && <p className="cover-error" role="alert">{coverError}</p>}</div><div className="collection-field"><span>Коллекции</span><button type="button" className="collection-trigger" onClick={(event) => { const b = event.currentTarget.getBoundingClientRect(); setIsCollectionMenuUp(window.innerHeight - b.bottom < 210); setIsCollectionMenuOpen((open) => !open); }} aria-expanded={isCollectionMenuOpen}><span>{selectedCollections.length ? selectedCollections.join(", ") : "Выбрать коллекции"}</span><ChevronDown size={18} /></button>{isCollectionMenuOpen && <div className={isCollectionMenuUp ? "collection-menu opens-up" : "collection-menu"}><div className="collection-options">{collections.map((collection) => <label key={collection.id}><input type="checkbox" checked={selectedCollections.includes(collection.name)} onChange={() => setSelectedCollections((current) => current.includes(collection.name) ? current.filter((name) => name !== collection.name) : [...current, collection.name])} /><span>{collection.name}</span></label>)}</div></div>}</div><div className="collection-field"><span>Статус</span><button type="button" className="collection-trigger" onClick={(event) => { const b = event.currentTarget.getBoundingClientRect(); setIsStatusMenuUp(window.innerHeight - b.bottom < 210); setIsStatusMenuOpen((open) => !open); }} aria-expanded={isStatusMenuOpen}><span>{status}</span><ChevronDown size={18} /></button>{isStatusMenuOpen && <div className={isStatusMenuUp ? "collection-menu opens-up" : "collection-menu"}><div className="collection-options">{filters.slice(1).map((item) => <label key={item}><input type="radio" name="editor-status" checked={item === status} onChange={() => { setStatus(item as BookStatus); setIsStatusMenuOpen(false); }} /><span>{item}</span></label>)}</div></div>}</div>{status === "Прочитано" && <><fieldset className="rating-picker"><legend>Оценка</legend><div>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button type="button" className={rating >= value ? "active" : ""} onClick={() => setRating(value)} key={value} aria-label={`Оценка ${value} из 10`}><Star size={17} fill="currentColor" /></button>)}</div></fieldset><label>Ревью<textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="Твои впечатления от книги" maxLength={1000} /></label></>}<button className="submit-button" type="submit">Сохранить изменения</button></form></div>;
}

export function LibraryView({ greetingTemplate }: { greetingTemplate: string }) {
  const { books, collections, genres, addBook, updateBook, deleteBook, createCollection: addCollection, advanceStatus, addGenre, renameGenre, deleteGenre, reorderGenres } = useLibrary();
  const [isGenreReorderMode, setIsGenreReorderMode] = useState(false);
  const { start: genreLpStart, cancel: genreLpCancel, pressing: genreLpPressing } = useLongPress(() => setIsGenreReorderMode(true));
  const [profileName, setProfileName] = useState("");
  const [filter, setFilter] = useState<BookStatus | "Все">("Все");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isGenreBrowserOpen, setIsGenreBrowserOpen] = useState(false);
  const [browsedGenre, setBrowsedGenre] = useState<string | null>(null);
  const [genreMenuId, setGenreMenuId] = useState<string | null>(null);
  const [genreMenuUp, setGenreMenuUp] = useState(false);
  const [editingGenre, setEditingGenre] = useState<string | null>(null);
  const [editingGenreName, setEditingGenreName] = useState("");
  const [isAddingGenre, setIsAddingGenre] = useState(false);
  const [newGenreInput, setNewGenreInput] = useState("");
  const [newGenreBookIds, setNewGenreBookIds] = useState<number[]>([]);
  const [editingGenreBookIds, setEditingGenreBookIds] = useState<number[]>([]);
  const [genreBookSearch, setGenreBookSearch] = useState("");
  const [genrePendingDelete, setGenrePendingDelete] = useState<string | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null);
  const [reviewingBook, setReviewingBook] = useState<Book | null>(null);
  const [actionsMenuBookId, setActionsMenuBookId] = useState<number | null>(null);
  const [collectionSubMenuBookId, setCollectionSubMenuBookId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("Без жанра");
  const [status, setStatus] = useState<BookStatus>("Не читано");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [isCollectionMenuOpen, setIsCollectionMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [isStatusMenuUp, setIsStatusMenuUp] = useState(false);
  const [isCollectionMenuUp, setIsCollectionMenuUp] = useState(false);
  const [actionsMenuUp, setActionsMenuUp] = useState(false);
  const [actionsMenuRight, setActionsMenuRight] = useState(false);
  const [isNewCollectionOpen, setIsNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isGenreMenuOpen, setIsGenreMenuOpen] = useState(false);
  const [isGenreMenuUp, setIsGenreMenuUp] = useState(false);
  const [isNewGenreOpen, setIsNewGenreOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverError, setCoverError] = useState("");
  const [isBookFlying, setIsBookFlying] = useState(false);
  const [flightStyle, setFlightStyle] = useState<FlightStyle | null>(null);
  const collectionFieldRef = useRef<HTMLDivElement>(null);
  const statusFieldRef = useRef<HTMLDivElement>(null);
  const genreFieldRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const bookGridRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const visibleBooks = books
    .filter((book) => (book.status === "Хочу купить" ? filter === "Хочу купить" : filter === "Все" || book.status === filter) && (!deferredQuery || `${book.title} ${book.author} ${book.genre}`.toLowerCase().includes(deferredQuery)))
    .sort((a, b) => filter === "Прочитано" ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "") : 0);
  const monthGroups = filter === "Прочитано" ? (() => {
    const groups = new Map<string, { label: string; sort: string; books: typeof visibleBooks }>();
    for (const book of visibleBooks) {
      const sort = book.completedAt ? book.completedAt.slice(0, 7) : "0000-00";
      const label = book.completedAt ? (() => { const s = new Date(book.completedAt).toLocaleDateString("ru-RU", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); })() : "Дата не указана";
      if (!groups.has(sort)) groups.set(sort, { label, sort, books: [] });
      groups.get(sort)!.books.push(book);
    }
    return [...groups.values()].sort((a, b) => b.sort.localeCompare(a.sort));
  })() : [];
  const collectionNames = collections.map((collection) => collection.name).sort((first, second) => first.localeCompare(second, "ru"));
  const genreOptions = [...new Set(["Без жанра", ...genres, ...books.map((book) => book.genre).filter(Boolean)])].sort((a, b) => a === "Без жанра" ? -1 : b === "Без жанра" ? 1 : a.localeCompare(b, "ru"));
  const bookGenreNames = books.map((book) => book.genre).filter(Boolean);
  const allGenres = [...new Set([...genres, ...bookGenreNames.filter((n) => !genres.includes(n))])].map((name) => ({ name, count: books.filter((book) => book.genre === name).length }));

  useEffect(() => {
    async function loadProfileName() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      setProfileName(data?.display_name || String(user.user_metadata.display_name || ""));
    }
    void loadProfileName();
  }, []);
  const greeting = greetingTemplate.replaceAll("{Имя}", profileName || "читатель");

  useEffect(() => {
    function closeFloatingControls(event: PointerEvent) {
      if (!collectionFieldRef.current?.contains(event.target as Node)) { setIsCollectionMenuOpen(false); setIsNewCollectionOpen(false); }
      if (!statusFieldRef.current?.contains(event.target as Node)) setIsStatusMenuOpen(false);
      if (!genreFieldRef.current?.contains(event.target as Node)) { setIsGenreMenuOpen(false); setIsNewGenreOpen(false); }
      if (!actionMenuRef.current?.contains(event.target as Node)) { setActionsMenuBookId(null); setCollectionSubMenuBookId(null); }
    }
    document.addEventListener("pointerdown", closeFloatingControls);
    return () => document.removeEventListener("pointerdown", closeFloatingControls);
  }, []);

  function resetComposer() {
    setTitle(""); setAuthor(""); setDescription(""); setGenre("Без жанра"); setSelectedCollections([]); setCoverImage(null); setCoverError(""); setStatus("Не читано"); setRating(0); setReview(""); setFormError("");
    setIsCollectionMenuOpen(false); setIsNewCollectionOpen(false); setIsStatusMenuOpen(false); setIsGenreMenuOpen(false); setIsNewGenreOpen(false); setNewGenreName(""); setNewCollectionName(""); setEditingBook(null);
  }

  function openNewBookComposer() { resetComposer(); setIsOpen(true); }
  function animateBookDeletion(book: Book) {
    setDeletingBookId(book.id);
    window.setTimeout(() => { deleteBook(book.id); setDeletingBookId(null); }, 900);
  }
  function closeBookComposer() { if (!isBookFlying) { resetComposer(); setIsOpen(false); } }
  function openBookEditor(book: Book) {
    setActionsMenuBookId(null);
    setEditingBook(book);
    setTitle(book.title); setAuthor(book.author); setDescription(book.description ?? ""); setGenre(book.genre); setStatus(book.status); setRating(book.rating ?? 0); setReview(book.review ?? ""); setFormError(""); setSelectedCollections(book.collections);
    setCoverImage(book.coverImage ?? null); setCoverError(""); setIsCollectionMenuOpen(false); setIsNewCollectionOpen(false); setIsOpen(true);
  }

  function addNewBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !author.trim() || isBookFlying) return;
    if (status === "Прочитано" && (!rating || !review.trim())) { setFormError("Для прочитанной книги нужны оценка и ревью."); return; }
    if (editingBook) {
      updateBook(editingBook.id, { title: title.trim(), author: author.trim(), description: description.trim() || undefined, genre: genre || "Без жанра", status, rating: rating || undefined, review: review.trim() || undefined, initials: title.trim().slice(0, 2).toUpperCase(), coverImage: coverImage ?? undefined, collections: selectedCollections });
      closeBookComposer();
      return;
    }
    const composerRect = composerRef.current?.getBoundingClientRect();
    const targetRect = bookGridRef.current?.querySelector<HTMLElement>(".cover")?.getBoundingClientRect();
    if (composerRect && targetRect) {
      setFlightStyle({ "--flight-x": `${targetRect.left + targetRect.width / 2 - (composerRect.left + composerRect.width / 2)}px`, "--flight-y": `${targetRect.top + targetRect.height / 2 - (composerRect.top + composerRect.height / 2)}px`, "--form-width": `${composerRect.width}px`, "--form-height": `${composerRect.height}px`, "--flight-width": `${targetRect.width}px`, "--flight-height": `${targetRect.height}px`, "--flight-color": "#6b5c93" });
      setIsBookFlying(true);
    }
    const completeAddition = () => {
      addBook({ title: title.trim(), author: author.trim(), description: description.trim() || undefined, genre: genre || "Без жанра", status, rating: rating || undefined, review: review.trim() || undefined, color: "#6b5c93", spine: "#d7cdea", initials: title.trim().slice(0, 2).toUpperCase(), coverImage: coverImage ?? undefined, collections: selectedCollections });
      setIsBookFlying(false); setFlightStyle(null); resetComposer(); setIsOpen(false);
    };
    if (composerRect && targetRect) window.setTimeout(completeAddition, 760); else completeAddition();
  }

  function toggleCollection(collection: string) { setSelectedCollections((current) => current.includes(collection) ? current.filter((item) => item !== collection) : [...current, collection]); }
  function createCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    const existing = collectionNames.find((collection) => collection.localeCompare(name, "ru", { sensitivity: "accent" }) === 0);
    const created = existing ?? addCollection(name, [])?.name;
    if (!created) return;
    setSelectedCollections((current) => current.includes(created) ? current : [...current, created]);
    setNewCollectionName(""); setIsNewCollectionOpen(false); setIsCollectionMenuOpen(false);
  }
  function selectCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setCoverError("Выбери файл изображения."); return; }
    if (file.size > 6 * 1024 * 1024) { setCoverError("Размер обложки не должен превышать 6 МБ."); return; }
    const reader = new FileReader();
    reader.onload = () => { setCoverImage(typeof reader.result === "string" ? reader.result : null); setCoverError(""); };
    reader.readAsDataURL(file);
  }

  const renderBook = (book: Book): React.ReactElement => <article className={deletingBookId === book.id ? "book-card is-deleting" : "book-card"} key={book.id}>
          <button className="cover" style={{ "--cover": book.color, "--spine": book.spine } as React.CSSProperties} onClick={() => setSelectedBook(book)} aria-label={`Открыть детали: ${book.title}`}>
            {book.coverImage && <Image className="cover-image" src={book.coverImage} alt="" fill unoptimized sizes="(max-width: 680px) 50vw, 20vw" />}
            <span className="cover-spine" />{!book.coverImage && <span className="cover-symbol">{book.initials}</span>}{!book.coverImage && <span className="cover-title">{book.title}</span>}<span className="book-ghost" aria-hidden="true">👻</span>
          </button>
          <div className="book-details">
            <div className="book-meta"><span>{book.genre}</span><div className="book-actions" ref={actionsMenuBookId === book.id ? actionMenuRef : undefined}>
              <button onClick={(event) => { const b = event.currentTarget.getBoundingClientRect(); setActionsMenuUp(window.innerHeight - b.bottom < 160); setActionsMenuRight(b.left < window.innerWidth / 2); setActionsMenuBookId((current) => current === book.id ? null : book.id); }} aria-label={`Действия с книгой ${book.title}`} aria-expanded={actionsMenuBookId === book.id}><MoreHorizontal size={18} /></button>
              {actionsMenuBookId === book.id && <div className={["book-action-menu", actionsMenuUp ? "opens-up" : "", actionsMenuRight ? "opens-right" : ""].filter(Boolean).join(" ")} role="menu"><button role="menuitem" onClick={() => openBookEditor(book)}><Pencil size={15} /> Редактировать</button><button role="menuitem" onClick={(e) => { e.stopPropagation(); setCollectionSubMenuBookId((v) => v === book.id ? null : book.id); }}><Plus size={15} /> Добавить в коллекцию</button>{collectionSubMenuBookId === book.id && <div className="book-action-submenu">{collectionNames.length ? collectionNames.map((col) => <button key={col} role="menuitem" className={book.collections.includes(col) ? "submenu-item submenu-item--active" : "submenu-item"} onClick={() => { updateBook(book.id, { collections: book.collections.includes(col) ? book.collections.filter((c) => c !== col) : [...book.collections, col] }); setCollectionSubMenuBookId(null); setActionsMenuBookId(null); }}>{book.collections.includes(col) && <Check size={13} />}{col}</button>) : <span className="submenu-empty">Коллекций пока нет</span>}</div>}</div>}
            </div></div>
            <h3>{book.title}</h3><p>{book.author}</p><div className="book-footer"><span className={`status ${statusClass[book.status]}`}>{book.status === "Прочитано" && <Check size={13} />}{book.status}</span>{book.rating && <span className="rating">{book.rating}</span>}</div>
          </div>
        </article>;

  return <>
    <div className="page-content">
      <p className="home-greeting">{greeting}</p>
      <PageHeading eyebrow="Ходунячья библиотека ❤️" title="Книжная полочка" action={<button className="add-button" onClick={openNewBookComposer}><CirclePlus size={19} /><span>Добавить</span></button>} />
      <label className="search-field"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по библиотеке" /></label>
      <div className="filter-row" aria-label="Фильтр по статусу">{filters.map((item) => <button key={item} onClick={() => { setFilter(item); setIsGenreBrowserOpen(false); }} className={(!isGenreBrowserOpen && !browsedGenre && filter === item) ? "filter active" : "filter"}>{item}</button>)}<button className={`filter${(isGenreBrowserOpen || browsedGenre) ? " active" : ""}`} onClick={() => setIsGenreBrowserOpen((v) => !v)}>Жанры</button></div>
      {isGenreBrowserOpen ? <><div className="section-heading" style={{ marginTop: "20px" }}><h2>Жанры</h2><button type="button" className="add-button" onClick={() => setIsAddingGenre(true)}><CirclePlus size={19} /><span>Добавить</span></button></div><><div className={`grid-edit-bar${isGenreReorderMode ? " grid-edit-bar--visible" : ""}`}><span>Удерживай и перетаскивай для сортировки</span><button type="button" className="grid-done-btn" onClick={() => setIsGenreReorderMode(false)}>Готово</button></div><SortableGrid items={allGenres.map(g => ({ ...g, id: g.name }))} onReorder={(newItems) => reorderGenres(newItems.map(g => g.name))} isEditMode={isGenreReorderMode} onEnterEditMode={() => setIsGenreReorderMode(true)} containerStyle={{ marginTop: "12px" }} renderItem={({ name, count }) => <article className="collection-tile"><button type="button" className="collection-tile-main" onClick={() => setBrowsedGenre(name)}><span><Sparkles size={20} /></span><strong>{name}</strong><small>{count} {count === 1 ? "книга" : "книг"}</small></button><div className="collection-actions"><button type="button" className="collection-menu-trigger" onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setGenreMenuUp(window.innerHeight - b.bottom < 120); setGenreMenuId((v) => v === name ? null : name); }} aria-label={`Действия с жанром ${name}`} aria-expanded={genreMenuId === name}><MoreHorizontal size={18} /></button>{genreMenuId === name && <div className={genreMenuUp ? "book-action-menu opens-up" : "book-action-menu"} role="menu"><button role="menuitem" onClick={() => { setEditingGenre(name); setEditingGenreName(name); setEditingGenreBookIds(books.filter((b) => b.genre === name).map((b) => b.id)); setGenreMenuId(null); }}><Pencil size={15} /> Редактировать</button><button className="collection-delete-option" role="menuitem" onClick={() => { setGenrePendingDelete(name); setGenreMenuId(null); }}><Trash2 size={15} /> Удалить жанр</button></div>}</div></article>} />{!allGenres.length && <div className="empty-state" style={{ gridColumn: "1 / -1" }}><Sparkles size={25} /><p>Жанры пока не заданы.</p></div>}</></> : <><div className="book-grid" ref={bookGridRef}>
        {(filter === "Прочитано" ? monthGroups.flatMap(({ label, sort, books: gb }): React.ReactElement[] => [<h3 key={`hdr-${sort}`} className="month-group-header">{label}</h3>, ...gb.map(renderBook)]) : visibleBooks.map(renderBook))}
      </div>
      {!visibleBooks.length && !isGenreBrowserOpen && <div className="empty-state"><BookOpen size={25} /><p>Таких книг пока нет.</p></div>}
      </>}
    </div>
    {isOpen && <div className={isBookFlying ? "modal-backdrop is-book-flying" : "modal-backdrop"} role="presentation" onMouseDown={closeBookComposer}>
      <form ref={composerRef} className={isBookFlying ? "book-composer is-book-flying" : "book-composer"} style={flightStyle ?? undefined} onSubmit={addNewBook} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flight-cover" aria-hidden="true">{coverImage && <Image src={coverImage} alt="" fill unoptimized sizes="220px" />}<span>{title.trim().slice(0, 2).toUpperCase()}</span><strong>{title}</strong></div>
        <div className="composer-heading"><div><p className="eyebrow">{editingBook ? "Твоя книга" : "Новая история"}</p><h2>{editingBook ? "Редактировать книгу" : "Добавить книгу"}</h2></div><button type="button" className="icon-button" onClick={closeBookComposer} aria-label="Закрыть" disabled={isBookFlying}>×</button></div>
        <label>Название<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Дюна" disabled={isBookFlying} /></label>
        <label>Автор<input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Фрэнк Герберт" disabled={isBookFlying} /></label>
        <div className="collection-field" ref={genreFieldRef}><span>Жанр</span><button type="button" className="collection-trigger" onClick={(event) => { const b = event.currentTarget.getBoundingClientRect(); setIsGenreMenuUp(window.innerHeight - b.bottom < 210); setIsGenreMenuOpen((open) => !open); }} aria-expanded={isGenreMenuOpen} disabled={isBookFlying}><span>{genre}</span><ChevronDown size={18} /></button>{isGenreMenuOpen && <div className={isGenreMenuUp ? "collection-menu opens-up" : "collection-menu"}><button className="create-collection-option" type="button" onClick={() => setIsNewGenreOpen(true)}><Plus size={16} /> Добавить жанр</button><div className="collection-options">{genreOptions.map((g) => <label key={g}><input type="radio" name="book-genre" checked={g === genre} onChange={() => { setGenre(g); setIsGenreMenuOpen(false); }} /><span>{g}</span></label>)}</div></div>}{isNewGenreOpen && <div className="new-collection-row"><input autoFocus value={newGenreName} onChange={(event) => setNewGenreName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (newGenreName.trim()) { setGenre(newGenreName.trim()); setNewGenreName(""); setIsNewGenreOpen(false); setIsGenreMenuOpen(false); } } }} placeholder="Название жанра" disabled={isBookFlying} /><button type="button" onClick={() => { if (newGenreName.trim()) { setGenre(newGenreName.trim()); setNewGenreName(""); setIsNewGenreOpen(false); setIsGenreMenuOpen(false); } }}>Добавить</button></div>}</div>
        <label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="О чем эта книга и почему она тебе запомнилась" maxLength={500} disabled={isBookFlying} /></label>
        <div className="cover-upload"><span>Обложка</span>{coverImage ? <div className="cover-preview"><Image src={coverImage} alt="Предпросмотр обложки" width={52} height={70} unoptimized /><div><strong>Обложка выбрана</strong><button type="button" onClick={() => setCoverImage(null)}><X size={15} /> Удалить</button></div></div> : <label className="cover-upload-trigger"><ImagePlus size={20} /><span>Загрузить обложку</span><small>Фото или изображение до 2 МБ</small><input type="file" accept="image/*" onChange={selectCover} disabled={isBookFlying} /></label>}{coverError && <p className="cover-error" role="alert">{coverError}</p>}</div>
        <div className="collection-field" ref={collectionFieldRef}><span>Коллекции</span><button type="button" className="collection-trigger" onClick={(event) => { const b = event.currentTarget.getBoundingClientRect(); setIsCollectionMenuUp(window.innerHeight - b.bottom < 210); setIsCollectionMenuOpen((open) => !open); }} aria-expanded={isCollectionMenuOpen} disabled={isBookFlying}><span>{selectedCollections.length ? selectedCollections.join(", ") : "Выбрать коллекции"}</span><ChevronDown size={18} /></button>{isCollectionMenuOpen && <div className={isCollectionMenuUp ? "collection-menu opens-up" : "collection-menu"}><button className="create-collection-option" type="button" onClick={() => setIsNewCollectionOpen(true)}><Plus size={16} /> Создать коллекцию</button><div className="collection-options">{collectionNames.map((collection) => <label key={collection}><input type="checkbox" checked={selectedCollections.includes(collection)} onChange={() => toggleCollection(collection)} /><span>{collection}</span></label>)}{!collectionNames.length && <p>Коллекций пока нет.</p>}</div></div>}{isNewCollectionOpen && <div className="new-collection-row"><input autoFocus value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createCollection(); } }} placeholder="Название новой коллекции" /><button type="button" onClick={createCollection}>Создать</button></div>}</div>
        <div className="collection-field" ref={statusFieldRef}><span>Статус</span><button type="button" className="collection-trigger" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setIsStatusMenuUp(window.innerHeight - rect.bottom < 210); setIsStatusMenuOpen((open) => !open); }} aria-expanded={isStatusMenuOpen} disabled={isBookFlying}><span>{status}</span><ChevronDown size={18} /></button>{isStatusMenuOpen && <div className={isStatusMenuUp ? "collection-menu opens-up" : "collection-menu"}><div className="collection-options">{filters.slice(1).map((item) => <label key={item}><input type="radio" name="book-status" checked={item === status} onChange={() => { setStatus(item as BookStatus); setIsStatusMenuOpen(false); }} /><span>{item}</span></label>)}</div></div>}</div>
        {status === "Прочитано" && <><fieldset className="rating-picker"><legend>Оценка</legend><div>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button type="button" className={rating >= value ? "active" : ""} onClick={() => setRating(value)} key={value}><Star size={17} fill="currentColor" /></button>)}</div></fieldset><label>Ревью<textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="Твои впечатления от книги" maxLength={1000} /></label></>}
        {formError && <p className="review-error" role="alert">{formError}</p>}
        <button className="submit-button" type="submit" disabled={isBookFlying}>{editingBook ? "Сохранить изменения" : "Добавить в библиотеку"}</button>
      </form>
    </div>}
    {browsedGenre && <CollectionBooksModal name={browsedGenre} eyebrow="Жанр" books={books.filter((book) => book.genre === browsedGenre)} onClose={() => setBrowsedGenre(null)} onSelectBook={(book) => setSelectedBook(book)} />}
    {editingGenre !== null && <div className="modal-backdrop" role="presentation" onMouseDown={() => { setEditingGenre(null); setGenreBookSearch(""); }}><form className="book-composer" onSubmit={(e) => { e.preventDefault(); const newName = editingGenreName.trim(); if (!newName) { setEditingGenre(null); return; } const oldName = editingGenre!; const originalIds = books.filter((b) => b.genre === oldName).map((b) => b.id); editingGenreBookIds.filter((id) => !originalIds.includes(id)).forEach((id) => updateBook(id, { genre: newName })); originalIds.filter((id) => !editingGenreBookIds.includes(id)).forEach((id) => updateBook(id, { genre: "" })); if (newName !== oldName) renameGenre(oldName, newName); setEditingGenre(null); setGenreBookSearch(""); }} onMouseDown={(e) => e.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">Жанр</p><h2>Редактировать жанр</h2></div><button type="button" className="icon-button" onClick={() => { setEditingGenre(null); setGenreBookSearch(""); }} aria-label="Закрыть">×</button></div><label>Название<input autoFocus value={editingGenreName} onChange={(e) => setEditingGenreName(e.target.value)} placeholder="Название жанра" /></label><fieldset className="collection-book-picker"><legend>Книги жанра</legend><input type="search" className="book-picker-search" placeholder="Поиск книги" value={genreBookSearch} onChange={(e) => setGenreBookSearch(e.target.value)} />{[...books].filter((book) => !genreBookSearch || book.title.toLowerCase().includes(genreBookSearch.toLowerCase()) || book.author.toLowerCase().includes(genreBookSearch.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title, "ru")).map((book) => <label key={book.id}><input type="checkbox" checked={editingGenreBookIds.includes(book.id)} onChange={() => setEditingGenreBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author}</small></span></label>)}</fieldset><button className="submit-button" type="submit">Сохранить</button></form></div>}
    {isAddingGenre && <div className="modal-backdrop" role="presentation" onMouseDown={() => { setIsAddingGenre(false); setNewGenreInput(""); setNewGenreBookIds([]); setGenreBookSearch(""); }}><form className="book-composer" onSubmit={(e) => { e.preventDefault(); const t = newGenreInput.trim(); if (!t) return; addGenre(t); newGenreBookIds.forEach((id) => updateBook(id, { genre: t })); setIsAddingGenre(false); setNewGenreInput(""); setNewGenreBookIds([]); setGenreBookSearch(""); }} onMouseDown={(e) => e.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">Жанры</p><h2>Добавить жанр</h2></div><button type="button" className="icon-button" onClick={() => { setIsAddingGenre(false); setNewGenreInput(""); setNewGenreBookIds([]); setGenreBookSearch(""); }} aria-label="Закрыть">×</button></div><label>Название<input autoFocus value={newGenreInput} onChange={(e) => setNewGenreInput(e.target.value)} placeholder="Например, Классика" /></label><fieldset className="collection-book-picker"><legend>Добавить книги</legend><input type="search" className="book-picker-search" placeholder="Поиск книги" value={genreBookSearch} onChange={(e) => setGenreBookSearch(e.target.value)} />{[...books].filter((book) => !genreBookSearch || book.title.toLowerCase().includes(genreBookSearch.toLowerCase()) || book.author.toLowerCase().includes(genreBookSearch.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title, "ru")).map((book) => <label key={book.id}><input type="checkbox" checked={newGenreBookIds.includes(book.id)} onChange={() => setNewGenreBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author}</small></span></label>)}</fieldset><button className="submit-button" type="submit" disabled={!newGenreInput.trim()}>Добавить жанр</button></form></div>}
    {genrePendingDelete && <div className="modal-backdrop confirmation-backdrop" role="presentation" onMouseDown={() => setGenrePendingDelete(null)}><section className="confirmation-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><p className="eyebrow">Удаление жанра</p><h2>Удалить жанр «{genrePendingDelete}»?{books.filter((b) => b.genre === genrePendingDelete).length > 0 && ` У ${books.filter((b) => b.genre === genrePendingDelete).length} книг будет снят жанр.`}</h2><div className="confirmation-actions"><button type="button" className="confirmation-cancel" onClick={() => setGenrePendingDelete(null)}>Отменить</button><button type="button" className="confirmation-delete" onClick={() => { deleteGenre(genrePendingDelete); setGenrePendingDelete(null); }}>Удалить</button></div></section></div>}
    {selectedBook && <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} onDelete={animateBookDeletion} onEdit={() => { setSelectedBook(null); openBookEditor(selectedBook); }} onRequestRead={() => { setSelectedBook(null); setReviewingBook(selectedBook); }} onAdvanceStatus={() => { advanceStatus(selectedBook.id); setSelectedBook((current) => current ? { ...current, status: current.status === "Не читано" ? "Читаю" : current.status === "Читаю" ? "Прочитано" : "Не читано" } : null); }} />}
    {reviewingBook && <ReadReviewModal book={reviewingBook} onClose={() => setReviewingBook(null)} onComplete={(completedRating, completedReview) => { updateBook(reviewingBook.id, { status: "Прочитано", rating: completedRating, review: completedReview }); setReviewingBook(null); }} />}
  </>;
}

export function StatsView() {
  const { books, advanceStatus } = useLibrary();
  const [browsedStat, setBrowsedStat] = useState<{ label: string; eyebrow: string; books: Book[] } | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const completedBooks = books.filter((book) => book.status === "Прочитано").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const currentDate = new Date();
  const booksThisMonth = completedBooks.filter((book) => {
    if (!book.completedAt) return false;
    const d = new Date(book.completedAt);
    return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
  });
  const booksThisYear = completedBooks.filter((book) => {
    if (!book.completedAt) return false;
    return new Date(book.completedAt).getFullYear() === currentDate.getFullYear();
  });
  const unreadBooksList = books.filter((book) => book.status === "Не читано");
  const purchasedBooksList = books.filter((book) => book.status !== "Хочу купить");
  const favoriteFrom = (values: string[]) => {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], "ru"))[0]?.[0] ?? "Пока нет";
  };
  const favoriteAuthor = favoriteFrom(completedBooks.map((book) => book.author));
  const favoriteGenre = favoriteFrom(completedBooks.map((book) => book.genre));
  const libraryProgress = books.length ? Math.round(completedBooks.length / books.length * 100) : 0;
  const open = (label: string, eyebrow: string, list: Book[]) => setBrowsedStat({ label, eyebrow, books: list });
  return <><div className="page-content"><PageHeading eyebrow="Твоя читательская история" title="Статистика" action={<span className="stats-date">{currentDate.toLocaleString("ru-RU", { month: "long", year: "numeric" })}</span>} /><div className="statistics-grid"><button type="button" className="stat-card stat-card-clickable" onClick={() => open("Всего томов", "в вашей библиотеке", purchasedBooksList)}><span className="stat-icon purchased"><BookOpen size={19} /></span><p>Всего томов</p><strong>{purchasedBooksList.length}</strong><small>в вашей библиотеке</small></button><button type="button" className="stat-card stat-card-clickable" onClick={() => open("Прочитано в этом месяце", "За текущий месяц", booksThisMonth)}><span className="stat-icon month"><Check size={19} /></span><p>Прочитано в этом месяце</p><strong>{booksThisMonth.length}</strong><small>книг завершено</small></button><button type="button" className="stat-card stat-card-clickable" onClick={() => open("Прочитано в этом году", `За ${currentDate.getFullYear()} год`, booksThisYear)}><span className="stat-icon year"><Check size={19} /></span><p>Прочитано в этом году</p><strong>{booksThisYear.length}</strong><small>книг за год</small></button><button type="button" className="stat-card stat-card-clickable" onClick={() => open("Прочитано всего", "Всё прочитанное", completedBooks)}><span className="stat-icon total"><BookOpen size={19} /></span><p>Прочитано всего</p><strong>{completedBooks.length}</strong><small>книг в библиотеке</small></button><button type="button" className="stat-card stat-card-clickable" onClick={() => open("Прогресс библиотеки", `${completedBooks.length} из ${books.length}`, completedBooks)}><span className="stat-icon progress"><Target size={19} /></span><p>Прогресс библиотеки</p><strong>{libraryProgress}%</strong><small>{completedBooks.length} из {books.length} книг</small></button><button type="button" className="stat-card stat-card-clickable" onClick={() => open("Ждут своей очереди", "Ещё не начаты", unreadBooksList)}><span className="stat-icon waiting"><Compass size={19} /></span><p>Ждут своей очереди</p><strong>{unreadBooksList.length}</strong><small>ещё не начаты</small></button><button type="button" className="stat-card stat-card-featured stat-card-clickable" onClick={() => open("Любимый автор", favoriteAuthor, completedBooks.filter((book) => book.author === favoriteAuthor))}><span className="stat-icon author"><Pencil size={19} /></span><p>Любимый автор</p><strong>{favoriteAuthor}</strong><small>чаще всего прочитан</small></button><button type="button" className="stat-card stat-card-featured stat-card-clickable" onClick={() => open("Любимый жанр", favoriteGenre, completedBooks.filter((book) => book.genre === favoriteGenre))}><span className="stat-icon genre"><Sparkles size={19} /></span><p>Любимый жанр</p><strong>{favoriteGenre}</strong><small>лидирует по прочтениям</small></button></div></div>{browsedStat && <CollectionBooksModal name={browsedStat.label} books={browsedStat.books} onClose={() => setBrowsedStat(null)} onSelectBook={(book) => setSelectedBook(book)} />}{selectedBook && <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} onAdvanceStatus={() => { advanceStatus(selectedBook.id); setSelectedBook(null); }} />}</>;
}

function CollectionBooksModal({ name, books, onClose, onSelectBook, eyebrow = "Коллекция" }: { name: string; books: Book[]; onClose: () => void; onSelectBook: (book: Book) => void; eyebrow?: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="book-composer collection-books-modal" role="dialog" aria-modal="true" aria-labelledby="coll-books-title" onMouseDown={(event) => event.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id="coll-books-title">{name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></div><div className="coll-books-list">{books.map((book) => <button type="button" key={book.id} onClick={() => onSelectBook(book)}><span className="book-list-thumb" style={{ background: book.color }}>{book.coverImage ? <Image src={book.coverImage} alt="" fill unoptimized sizes="37px" style={{ objectFit: "cover" }} /> : book.initials}</span><div><strong>{book.title}</strong><p>{book.author}</p><span className={`status ${statusClass[book.status]}`}>{book.status === "Прочитано" && <Check size={13} />}{book.status}</span></div></button>)}</div>{!books.length && <p className="empty-collection">В этой коллекции пока нет книг.</p>}</section></div>;
}

function CollectionDetailModal({ collection, onClose }: { collection: LibraryCollection; onClose: () => void }) {
  const { books, shelves, addShelf, updateShelf, deleteShelf, advanceStatus } = useLibrary();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isShelfComposerOpen, setIsShelfComposerOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [shelfName, setShelfName] = useState("");
  const [shelfBookIds, setShelfBookIds] = useState<number[]>([]);
  const [shelfBookSearch, setShelfBookSearch] = useState("");
  const [shelfMenuId, setShelfMenuId] = useState<string | null>(null);
  const [shelfPendingDelete, setShelfPendingDelete] = useState<Shelf | null>(null);
  const [deletingShelfId, setDeletingShelfId] = useState<string | null>(null);
  const [expandedShelfIds, setExpandedShelfIds] = useState<Set<string>>(new Set());
  function toggleShelf(id: string) { setExpandedShelfIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }

  const collectionBooks = books.filter((book) => book.collections.includes(collection.name));
  const collectionShelves = shelves.filter((shelf) => shelf.collectionId === collection.id).sort((a, b) => a.name.localeCompare(b.name, "ru"));

  function openShelfComposer(shelf?: Shelf) { setEditingShelf(shelf ?? null); setShelfName(shelf?.name ?? ""); setShelfBookIds(shelf?.bookIds ?? []); setShelfBookSearch(""); setShelfMenuId(null); setIsShelfComposerOpen(true); }
  function closeShelfComposer() { setIsShelfComposerOpen(false); setEditingShelf(null); setShelfName(""); setShelfBookIds([]); setShelfBookSearch(""); }
  function saveShelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shelfName.trim()) return;
    if (editingShelf) { updateShelf(editingShelf.id, shelfName.trim(), shelfBookIds); } else { addShelf(collection.id, shelfName.trim(), shelfBookIds); }
    closeShelfComposer();
  }

  if (isShelfComposerOpen) {
    return <div className="modal-backdrop" role="presentation" onMouseDown={closeShelfComposer}><form className="book-composer" onSubmit={saveShelf} onMouseDown={(e) => e.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">Полочка</p><h2>{editingShelf ? "Редактировать полочку" : "Новая полочка"}</h2></div><button type="button" className="icon-button" onClick={closeShelfComposer} aria-label="Закрыть">×</button></div><label>Название<input autoFocus value={shelfName} onChange={(e) => setShelfName(e.target.value)} placeholder="Например, Любимые" /></label><fieldset className="collection-book-picker"><legend>Книги на полочке</legend><input type="search" className="book-picker-search" placeholder="Поиск книги" value={shelfBookSearch} onChange={(e) => setShelfBookSearch(e.target.value)} />{collectionBooks.filter((book) => !shelfBookSearch || book.title.toLowerCase().includes(shelfBookSearch.toLowerCase()) || book.author.toLowerCase().includes(shelfBookSearch.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title, "ru")).map((book) => <label key={book.id}><input type="checkbox" checked={shelfBookIds.includes(book.id)} onChange={() => setShelfBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author}</small></span></label>)}</fieldset><div className="shelf-composer-actions"><button type="button" className="shelf-discard-btn" onClick={closeShelfComposer}>Отменить</button><button className="submit-button" type="submit" disabled={!shelfName.trim()}>{editingShelf ? "Сохранить" : "Создать полочку"}</button></div></form></div>;
  }

  return <><div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="book-composer collection-books-modal" role="dialog" aria-modal="true" aria-labelledby="coll-detail-title" onMouseDown={(e) => e.stopPropagation()} onPointerDown={() => setShelfMenuId(null)}><div className="composer-heading"><div><p className="eyebrow">Коллекция</p><h2 id="coll-detail-title">{collection.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></div><div className="shelf-section"><div className="shelf-section-heading"><h3>Полочки</h3><button type="button" className="add-button shelf-add-btn" onClick={(e) => { e.stopPropagation(); openShelfComposer(); }}><CirclePlus size={16} /><span>Добавить</span></button></div>{!collectionShelves.length && <p className="empty-collection">Полочек пока нет.</p>}{collectionShelves.map((shelf) => { const shelfBooks = collectionBooks.filter((b) => shelf.bookIds.includes(b.id)); const isExpanded = expandedShelfIds.has(shelf.id); return <div key={shelf.id} className={`shelf-card${isExpanded ? " shelf-card--expanded" : ""}${deletingShelfId === shelf.id ? " is-deleting" : ""}`}><div className="shelf-card-header" onPointerDown={(e) => e.stopPropagation()} onClick={() => toggleShelf(shelf.id)}><div className="shelf-card-meta"><strong>{shelf.name}</strong><small>{shelfBooks.length} {shelfBooks.length === 1 ? "книга" : "книг"}</small></div><div className="shelf-actions"><button type="button" className="collection-menu-trigger" onClick={(e) => { e.stopPropagation(); setShelfMenuId((v) => v === shelf.id ? null : shelf.id); }} aria-label={`Действия с полочкой ${shelf.name}`} aria-expanded={shelfMenuId === shelf.id}><MoreHorizontal size={18} /></button>{shelfMenuId === shelf.id && <div className="book-action-menu" role="menu"><button role="menuitem" onClick={() => openShelfComposer(shelf)}><Pencil size={15} /> Редактировать</button><button className="collection-delete-option" role="menuitem" onClick={() => { setShelfMenuId(null); setShelfPendingDelete(shelf); }}><Trash2 size={15} /> Удалить</button></div>}</div><ChevronDown size={16} className={`shelf-chevron${isExpanded ? " shelf-chevron--open" : ""}`} /></div><div className={`shelf-books-wrap${isExpanded ? " shelf-books-wrap--open" : ""}`}><div className="shelf-books-inner">{shelfBooks.length > 0 ? <div className="shelf-books"><div className="coll-books-list">{shelfBooks.map((book) => <button type="button" key={book.id} onClick={() => setSelectedBook(book)}><span className="book-list-thumb" style={{ background: book.color }}>{book.coverImage ? <Image src={book.coverImage} alt="" fill unoptimized sizes="37px" style={{ objectFit: "cover" }} /> : book.initials}</span><div><strong>{book.title}</strong><p>{book.author}</p><span className={`status ${statusClass[book.status]}`}>{book.status === "Прочитано" && <Check size={13} />}{book.status}</span></div></button>)}</div></div> : <p className="empty-collection shelf-empty">Книг на полочке пока нет.</p>}</div></div></div>; })}</div><div className="coll-books-list">{collectionBooks.map((book) => <button type="button" key={book.id} onClick={() => setSelectedBook(book)}><span className="book-list-thumb" style={{ background: book.color }}>{book.coverImage ? <Image src={book.coverImage} alt="" fill unoptimized sizes="37px" style={{ objectFit: "cover" }} /> : book.initials}</span><div><strong>{book.title}</strong><p>{book.author}</p><span className={`status ${statusClass[book.status]}`}>{book.status === "Прочитано" && <Check size={13} />}{book.status}</span></div></button>)}{!collectionBooks.length && <p className="empty-collection">В этой коллекции пока нет книг.</p>}</div></section></div>{selectedBook && <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} onAdvanceStatus={() => { advanceStatus(selectedBook.id); setSelectedBook(null); }} />}{shelfPendingDelete && <div className="modal-backdrop confirmation-backdrop" role="presentation" onMouseDown={() => setShelfPendingDelete(null)}><section className="confirmation-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><p className="eyebrow">Удаление полочки</p><h2>Удалить полочку «{shelfPendingDelete.name}»?</h2><div className="confirmation-actions"><button type="button" className="confirmation-cancel" onClick={() => setShelfPendingDelete(null)}>Отменить</button><button type="button" className="confirmation-delete" onClick={() => { const id = shelfPendingDelete.id; setShelfPendingDelete(null); setDeletingShelfId(id); window.setTimeout(() => { deleteShelf(id); setDeletingShelfId(null); }, 380); }}>Удалить</button></div></section></div>}</>;
}

export function CollectionsView() {
  const { books, collections, createCollection, updateCollection, deleteCollection, reorderCollections } = useLibrary();
  const [isReorderMode, setIsReorderMode] = useState(false);
  const { start: lpStart, cancel: lpCancel, pressing: lpPressing } = useLongPress(() => setIsReorderMode(true));

  const [browsedCollection, setBrowsedCollection] = useState<LibraryCollection | null>(null);
  const [editingCollection, setEditingCollection] = useState<LibraryCollection | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [collectionMenuId, setCollectionMenuId] = useState<string | null>(null);
  const [collectionPendingDeletion, setCollectionPendingDeletion] = useState<LibraryCollection | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionColor, setCollectionColor] = useState("");
  const [selectedBookIds, setSelectedBookIds] = useState<number[]>([]);
  const [bookSearch, setBookSearch] = useState("");
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const isCollectionFlyingRef = useRef(false);

  function closeEditor() { setEditingCollection(null); setIsCreateOpen(false); setCollectionName(""); setCollectionColor(""); setSelectedBookIds([]); setBookSearch(""); }
  function openEditor(collection?: LibraryCollection) {
    setCollectionMenuId(null);
    setEditingCollection(collection ?? null);
    setCollectionName(collection?.name ?? "");
    setCollectionColor(collection?.color ?? "");
    setSelectedBookIds(collection ? books.filter((book) => book.collections.includes(collection.name)).map((book) => book.id) : []);
    setIsCreateOpen(true);
  }
  function saveCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!collectionName.trim() || isCollectionFlyingRef.current) return;
    if (editingCollection) {
      updateCollection(editingCollection.id, collectionName, selectedBookIds, collectionColor || undefined);
      if (browsedCollection?.name === editingCollection.name) setBrowsedCollection({ id: editingCollection.id, name: collectionName.trim(), color: collectionColor || undefined });
      closeEditor();
      return;
    }
    const collection = createCollection(collectionName, selectedBookIds, collectionColor || undefined);
    if (!collection) return;
    const form = event.currentTarget;
    const target = document.querySelector<HTMLElement>(".collection-page-grid")?.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    if (!target) { closeEditor(); return; }
    isCollectionFlyingRef.current = true;
    form.dataset.collectionTitle = collection.name;
    form.style.setProperty("--collection-flight-x", `${target.left - formRect.left}px`);
    form.style.setProperty("--collection-flight-y", `${target.top - formRect.top}px`);
    form.style.setProperty("--collection-flight-width", `${Math.min(target.width / 2, 220)}px`);
    form.classList.add("is-collection-flying");
    window.setTimeout(() => { isCollectionFlyingRef.current = false; closeEditor(); }, 620);
  }
  function removeCollection(collection: LibraryCollection) {
    setCollectionPendingDeletion(null);
    if (browsedCollection?.id === collection.id) setBrowsedCollection(null);
    setDeletingCollectionId(collection.id);
    closeEditor();
    window.setTimeout(() => { deleteCollection(collection.id); setDeletingCollectionId(null); }, 500);
  }

  return <><div className="page-content"><PageHeading eyebrow="По настроению" title="Мои коллекции" action={<button className="add-button" onClick={() => openEditor()}><CirclePlus size={19} /><span>Добавить коллекцию</span></button>} /><><div className={`grid-edit-bar${isReorderMode ? " grid-edit-bar--visible" : ""}`}><span>Удерживай и перетаскивай для сортировки</span><button type="button" className="grid-done-btn" onClick={() => setIsReorderMode(false)}>Готово</button></div><SortableGrid items={collections} onReorder={(newItems) => reorderCollections(newItems.map(c => c.id))} isEditMode={isReorderMode} onEnterEditMode={() => setIsReorderMode(true)} renderItem={(collection) => { const collectionBooks = books.filter((book) => book.collections.includes(collection.name)); const showMenuInTile = !isReorderMode && collectionMenuId === collection.id; return <article className={`collection-tile ${deletingCollectionId === collection.id ? "is-deleting" : ""} ${showMenuInTile ? "showing-menu" : ""}`} style={collection.color ? { "--ct-color": collection.color } as React.CSSProperties : undefined} key={collection.id}>{!showMenuInTile ? <><button type="button" className="collection-tile-main" onClick={() => setBrowsedCollection(collection)}><span><BookOpen size={20} /></span><strong>{collection.name}</strong><small>{collectionBooks.length} {collectionBooks.length === 1 ? "книга" : "книг"}</small></button><div className="collection-actions"><button type="button" className="collection-menu-trigger" onClick={() => setCollectionMenuId((current) => current === collection.id ? null : collection.id)} aria-label={`Действия с коллекцией ${collection.name}`} aria-expanded={showMenuInTile}><MoreHorizontal size={18} /></button></div></> : <div className="collection-tile-menu"><button type="button" className="collection-tile-menu-item" onClick={() => openEditor(collection)}><Pencil size={18} /><span>Редактировать</span></button><button type="button" className="collection-tile-menu-item collection-tile-menu-delete" onClick={() => { setCollectionMenuId(null); setCollectionPendingDeletion(collection); }}><Trash2 size={18} /><span>Удалить</span></button><button type="button" className="collection-tile-menu-close" onClick={() => setCollectionMenuId(null)}>✕</button></div>}</article>; }} />{!collections.length && <div className="empty-state"><BookOpen size={25} /><p>Создай первую коллекцию для любимых книг.</p></div>}</>{browsedCollection && <CollectionDetailModal collection={browsedCollection} onClose={() => setBrowsedCollection(null)} />}</div>{isCreateOpen && <div className="modal-backdrop" role="presentation" onMouseDown={closeEditor}><form className="book-composer collection-composer" onSubmit={saveCollection} onMouseDown={(event) => event.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">Твоя подборка</p><h2>{editingCollection ? "Редактировать коллекцию" : "Новая коллекция"}</h2></div><button type="button" className="icon-button" onClick={closeEditor} aria-label="Закрыть">×</button></div><label>Название<input autoFocus value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Например, Летнее чтение" /></label><div className="collection-color-picker"><span>Цвет тайла</span><div>{["", "#d96650", "#356457", "#385b8e", "#6a5a99", "#d79d37", "#1f7068", "#b55c43", "#607b8e"].map((c) => <button type="button" key={c || "auto"} className={collectionColor === c ? "color-swatch active" : "color-swatch"} style={c ? { background: c } : undefined} onClick={() => setCollectionColor(c)} aria-label={c || "Авто"}>{!c && "А"}</button>)}</div></div><fieldset className="collection-book-picker"><legend>Книги в коллекции</legend><input type="search" className="book-picker-search" placeholder="Поиск книги" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} />{[...books].filter((book) => !bookSearch || book.title.toLowerCase().includes(bookSearch.toLowerCase()) || book.author.toLowerCase().includes(bookSearch.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title, "ru")).map((book) => <label key={book.id}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => setSelectedBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author}</small></span></label>)}{!books.length && <p>Сначала добавь книги в библиотеку.</p>}</fieldset><button className="submit-button" type="submit">{editingCollection ? "Сохранить изменения" : "Создать коллекцию"}</button>{editingCollection && <button type="button" className="delete-button" onClick={() => setCollectionPendingDeletion(editingCollection)}><Trash2 size={17} /> Удалить коллекцию</button>}</form></div>}{collectionPendingDeletion && <div className="modal-backdrop confirmation-backdrop" role="presentation" onMouseDown={() => setCollectionPendingDeletion(null)}><section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-collection-title" onMouseDown={(event) => event.stopPropagation()}><p className="eyebrow">Удаление коллекции</p><h2 id="delete-collection-title">{`Удалить коллекцию «${collectionPendingDeletion.name}»? Книги останутся в библиотеке.`}</h2><div className="confirmation-actions"><button type="button" className="confirmation-cancel" onClick={() => setCollectionPendingDeletion(null)}>Отменить</button><button type="button" className="confirmation-delete" onClick={() => removeCollection(collectionPendingDeletion)}>Удалить</button></div></section></div>}</>;
}

export function LegacyCollectionsView() {
  const { books, collections, createCollection, advanceStatus } = useLibrary();
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedBookIds, setSelectedBookIds] = useState<number[]>([]);
  const [bookSearch, setBookSearch] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const isCollectionFlyingRef = useRef(false);
  const collectionNames = collections.map((collection) => collection.name).sort((first, second) => first.localeCompare(second, "ru"));
  const selectedBooks = activeCollection ? books.filter((book) => book.collections.includes(activeCollection)) : [];
  function submitCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCollectionFlyingRef.current) return;
    const collection = createCollection(newCollectionName, selectedBookIds);
    if (!collection) return;
    const form = event.currentTarget;
    const target = document.querySelector<HTMLElement>(".collection-page-grid")?.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    setActiveCollection(collection.name);
    if (!target) { setNewCollectionName(""); setSelectedBookIds([]); setIsCreateOpen(false); return; }
    isCollectionFlyingRef.current = true;
    form.dataset.collectionTitle = collection.name;
    form.style.setProperty("--collection-flight-x", `${target.left - formRect.left}px`);
    form.style.setProperty("--collection-flight-y", `${target.top - formRect.top}px`);
    form.style.setProperty("--collection-flight-width", `${Math.min(target.width / 2, 220)}px`);
    form.classList.add("is-collection-flying");
    window.setTimeout(() => { isCollectionFlyingRef.current = false; setNewCollectionName(""); setSelectedBookIds([]); setIsCreateOpen(false); }, 620);
  }
  return <><div className="page-content"><PageHeading eyebrow="По настроению" title="Мои коллекции" action={<button className="add-button" onClick={() => setIsCreateOpen(true)}><CirclePlus size={19} /><span>Добавить коллекцию</span></button>} /><div className="collection-page-grid">{collectionNames.map((collection) => { const count = books.filter((book) => book.collections.includes(collection)).length; return <button className={activeCollection === collection ? "collection-tile active" : "collection-tile"} key={collection} onClick={() => setActiveCollection(collection)}><span><BookOpen size={20} /></span><strong>{collection}</strong><small>{count} {count === 1 ? "книга" : "книг"}</small></button>; })}</div>{activeCollection && <section className="selected-collection"><div className="section-heading"><h2>{activeCollection}</h2><button className="collection-reset" onClick={() => setActiveCollection(null)}>Скрыть</button></div><div className="collection-book-list">{selectedBooks.map((book) => <button type="button" key={book.id} onClick={() => setSelectedBook(book)}><span style={{ background: book.color }}>{book.initials}</span><div><strong>{book.title}</strong><p>{book.author}</p><span className={`status ${statusClass[book.status]}`}>{book.status === "Прочитано" && <Check size={13} />}{book.status}</span></div></button>)}</div>{!selectedBooks.length && <p className="empty-collection">В этой коллекции пока нет книг.</p>}</section>}{!collectionNames.length && <div className="empty-state"><BookOpen size={25} /><p>Создай первую коллекцию для любимых книг.</p></div>}</div>{isCreateOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsCreateOpen(false)}><form className="book-composer collection-composer" onSubmit={submitCollection} onMouseDown={(event) => event.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">Твоя подборка</p><h2>Новая коллекция</h2></div><button type="button" className="icon-button" onClick={() => setIsCreateOpen(false)} aria-label="Закрыть">×</button></div><label>Название<input autoFocus value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder="Например, Книги для лета" /></label><fieldset className="collection-book-picker"><legend>Добавить книги</legend><input type="search" className="book-picker-search" placeholder="Поиск книги" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} />{[...books].filter((book) => !bookSearch || book.title.toLowerCase().includes(bookSearch.toLowerCase()) || book.author.toLowerCase().includes(bookSearch.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title, "ru")).map((book) => <label key={book.id}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => setSelectedBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author}</small></span></label>)}{!books.length && <p>В библиотеке пока нет книг.</p>}</fieldset><button className="submit-button" type="submit">Создать коллекцию</button></form></div>}{selectedBook && <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} onEdit={() => setSelectedBook(null)} onAdvanceStatus={() => { advanceStatus(selectedBook.id); setSelectedBook((current) => current ? { ...current, status: current.status === "Не читано" ? "Читаю" : current.status === "Читаю" ? "Прочитано" : "Не читано" } : null); }} />}</>;
}

export function GoalsView() {
  const { books, goals, addGoal, updateGoal, removeGoal, reorderGoals } = useLibrary();
  const [isReorderMode, setIsReorderMode] = useState(false);
  const { start: lpStart, cancel: lpCancel, pressing: lpPressing } = useLongPress(() => setIsReorderMode(true));
  const [isOpen, setIsOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ReadingGoal | null>(null);
  const [title, setTitle] = useState("");
  const [selectedBookIds, setSelectedBookIds] = useState<number[]>([]);
  const [bookSearch, setBookSearch] = useState("");
  const [browsedGoal, setBrowsedGoal] = useState<ReadingGoal | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const isGoalFlyingRef = useRef(false);
  const [deletingGoalId, setDeletingGoalId] = useState<number | null>(null);
  function closeGoalForm() { setIsOpen(false); setEditingGoal(null); setTitle(""); setSelectedBookIds([]); setBookSearch(""); }
  function openGoalEditor(goal?: ReadingGoal) { setEditingGoal(goal ?? null); setTitle(goal?.title ?? ""); setSelectedBookIds(goal?.bookIds ?? []); setIsOpen(true); }
  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !selectedBookIds.length || isGoalFlyingRef.current) return;
    if (editingGoal) { updateGoal(editingGoal.id, { title: title.trim(), bookIds: selectedBookIds }); closeGoalForm(); return; }
    const form = event.currentTarget;
    const target = document.querySelector<HTMLElement>(".goal-list")?.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    if (!target) { addGoal(title.trim(), selectedBookIds); closeGoalForm(); return; }
    isGoalFlyingRef.current = true;
    form.dataset.goalTitle = title.trim();
    form.style.setProperty("--goal-flight-x", `${target.left - formRect.left}px`);
    form.style.setProperty("--goal-flight-y", `${target.top - formRect.top}px`);
    form.style.setProperty("--goal-flight-width", `${Math.min(target.width, 480)}px`);
    form.classList.add("is-goal-flying");
    addGoal(title.trim(), selectedBookIds);
    window.setTimeout(() => { isGoalFlyingRef.current = false; closeGoalForm(); }, 620);
  }
  return <><div className="page-content"><PageHeading eyebrow="Небольшие шаги" title="Цели чтения" action={<button className="add-button" onClick={() => openGoalEditor()}><CirclePlus size={19} /><span>Добавить</span></button>} /><p className="section-intro">Прогресс считается по выбранным книгам, отмеченным как прочитанные.</p><><div className={`grid-edit-bar${isReorderMode ? " grid-edit-bar--visible" : ""}`}><span>Удерживай и перетаскивай для сортировки</span><button type="button" className="grid-done-btn" onClick={() => setIsReorderMode(false)}>Готово</button></div><SortableGrid items={goals.map((g) => ({ ...g, id: String(g.id) }))} onReorder={(newItems) => reorderGoals(newItems.map(g => Number(g.id)))} isEditMode={isReorderMode} onEnterEditMode={() => setIsReorderMode(true)} className="goal-list" renderItem={({ id: sid }) => { const goal = goals.find(g => g.id === Number(sid))!; const { completed, total } = getGoalProgress(goal, books); const percent = total ? Math.round((completed / total) * 100) : 0; return <article className={deletingGoalId === goal.id ? "goal-card is-deleting" : "goal-card"}><button type="button" className="goal-card-main" onClick={() => setBrowsedGoal(goal)} aria-label={`Просмотреть книги: ${goal.title}`}><div className="goal-card-heading"><span className="goal-target"><Target size={17} /></span></div><h3>{goal.title}</h3><div className="goal-progress-text"><span>{completed} из {total}</span><strong>{percent}%</strong></div><div className="goal-progress"><span style={{ width: `${percent}%` }} /></div></button><div className="goal-card-actions"><button className="goal-edit" onClick={() => openGoalEditor(goal)} aria-label={`Редактировать цель ${goal.title}`}><Pencil size={15} /></button></div></article>; }} />{!goals.length && <div className="empty-state"><Target size={25} /><p>Поставь первую цель чтения.</p></div>}</></div>{isOpen && <div className="modal-backdrop" role="presentation" onMouseDown={closeGoalForm}><form className="book-composer collection-composer" onSubmit={saveGoal} onMouseDown={(event) => event.stopPropagation()}><div className="composer-heading"><div><p className="eyebrow">Твой ориентир</p><h2>{editingGoal ? "Редактировать цель" : "Новая цель"}</h2></div><button type="button" className="icon-button" onClick={closeGoalForm} aria-label="Закрыть">×</button></div><label>Название цели<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Прочитать классику летом" /></label><fieldset className="collection-book-picker"><legend>Книги в цели</legend><input type="search" className="book-picker-search" placeholder="Поиск книги" value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} />{[...books].filter((book) => !bookSearch || book.title.toLowerCase().includes(bookSearch.toLowerCase()) || book.author.toLowerCase().includes(bookSearch.toLowerCase())).sort((a, b) => a.title.localeCompare(b.title, "ru")).map((book) => <label key={book.id}><input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => setSelectedBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span><strong>{book.title}</strong><small>{book.author}</small></span></label>)}{!books.length && <p>В библиотеке пока нет книг.</p>}</fieldset><button className="submit-button" type="submit">{editingGoal ? "Сохранить изменения" : "Создать цель"}</button>{editingGoal && <button className="profile-signout" type="button" onClick={() => { const goalId = editingGoal.id; closeGoalForm(); setDeletingGoalId(goalId); window.setTimeout(() => { removeGoal(goalId); setDeletingGoalId(null); }, 500); }}>Удалить цель</button>}</form></div>}{browsedGoal && <CollectionBooksModal name={browsedGoal.title} eyebrow="Цель" books={books.filter((book) => browsedGoal.bookIds.includes(book.id))} onClose={() => setBrowsedGoal(null)} onSelectBook={(book) => setSelectedBook(book)} />}{selectedBook && <BookDetailsModal book={selectedBook} onClose={() => setSelectedBook(null)} onAdvanceStatus={() => setSelectedBook(null)} />}</>;
}

export function DiscoverView() {
  const prompts = ["Книга с героиней, которая тебя вдохновляет", "Небольшая книга на один тихий вечер", "Автор, которого ты ещё не читала"];
  return <div className="page-content"><PageHeading eyebrow="Новая глава" title="Открытия" /><section className="discover-hero"><Compass size={27} /><h2>Выбери книгу по настроению</h2><p>Здесь скоро появится поиск по каталогу и ISBN. Пока сохрани идеи для следующего чтения.</p></section><div className="prompt-list">{prompts.map((prompt) => <button key={prompt}><Sparkles size={17} /><span>{prompt}</span><span>+</span></button>)}</div></div>;
}