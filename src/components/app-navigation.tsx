"use client";

import { BookOpen, BarChart2, Compass, Heart, LibraryBig, LogOut, Pencil, Target, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState, ViewTransition } from "react";
import { LibraryProvider } from "@/components/library-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const links = [
  { href: "/", label: "Библиотека", icon: LibraryBig },
  { href: "/collections", label: "Коллекции", icon: Heart },
  { href: "/stats", label: "Статистика", icon: BarChart2 },
  { href: "/goals", label: "Цели", icon: Target },
  { href: "/discover", label: "Открытия", icon: Compass },
];

export function AppNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "", about: "", preferences: "", avatarPath: "", avatarUrl: "" });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    if (!isProfileOpen) return;
    let isActive = true;
    async function loadProfile() {
      setIsLoadingProfile(true); setProfileError("");
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data, error } = await supabase.from("profiles").select("display_name, avatar_url, about, reading_preferences").eq("id", user.id).single();
      if (!isActive) return;
      if (error) { setProfileError("Не удалось загрузить профиль. Выполни миграцию Supabase для profiles."); }
      const avatarPath = data?.avatar_url || "";
      const { data: signedAvatar } = avatarPath ? await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60) : { data: null };
      setProfile({ name: data?.display_name || String(user.user_metadata.display_name || ""), email: user.email || "", about: data?.about || "", preferences: data?.reading_preferences || "", avatarPath, avatarUrl: signedAvatar?.signedUrl || "" });
      setIsLoadingProfile(false);
    }
    void loadProfile();
    return () => { isActive = false; };
  }, [isProfileOpen, router]);

  useEffect(() => {
    if (!isProfileOpen) return;
    function closeProfileWithAnimation(event: MouseEvent) {
      const target = event.target as Element;
      const backdrop = target.closest(".modal-backdrop");
      const isDismissTarget = target.closest(".profile-close") || target === backdrop;
      if (!backdrop || !isDismissTarget) return;
      event.preventDefault(); event.stopPropagation();
      const modal = backdrop.querySelector(".profile-modal");
      if (modal?.classList.contains("is-closing")) return;
      backdrop.classList.add("is-closing"); modal?.classList.add("is-closing");
      window.setTimeout(() => setIsProfileOpen(false), 180);
    }
    document.addEventListener("mousedown", closeProfileWithAnimation, true);
    document.addEventListener("click", closeProfileWithAnimation, true);
    return () => { document.removeEventListener("mousedown", closeProfileWithAnimation, true); document.removeEventListener("click", closeProfileWithAnimation, true); };
  }, [isProfileOpen]);

  useEffect(() => {
    async function checkAuth() {
      if (window.location.pathname === "/login") { setIsAuthChecked(true); return; }
      const { data: { user } } = await createSupabaseBrowserClient().auth.getUser();
      if (!user) window.location.assign("/login");
      else setIsAuthChecked(true);
    }
    void checkAuth();
  }, []);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { setProfileError("Выбери изображение до 2 МБ в формате PNG, JPEG или WebP."); return; }
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/avatar-${Date.now()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { setProfileError("Не удалось загрузить аватар."); return; }
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
    setProfile((current) => ({ ...current, avatarPath: path, avatarUrl: data?.signedUrl || "" }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setProfileError("");
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: profile.name.trim(), avatar_url: profile.avatarPath || null, about: profile.about.trim(), reading_preferences: profile.preferences.trim() }).eq("id", user.id);
    if (error) { setProfileError("Не удалось сохранить профиль."); return; }
    await supabase.auth.updateUser({ data: { display_name: profile.name.trim() } });
    setIsEditing(false);
  }

  async function signOut() { const supabase = createSupabaseBrowserClient(); await supabase.auth.signOut(); setIsProfileOpen(false); window.location.assign("/login"); }
  const initials = profile.name.trim().slice(0, 1).toUpperCase() || "Я";
  if (pathname === "/login") return <>{children}</>;
  if (!isAuthChecked) return null;
  return <LibraryProvider><main className="app-shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={20} strokeWidth={2.2} /></span><span>ЧитАль</span></Link><button className="avatar" onClick={() => setIsProfileOpen(true)} aria-label="Открыть профиль">{profile.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={36} height={36} unoptimized /> : initials}</button></header><nav className="primary-nav" aria-label="Основная навигация">{links.map(({ href, label, icon: Icon }) => <Link key={href} className={pathname === href ? "nav-item active" : "nav-item"} href={href}><Icon size={20} /><span>{label}</span></Link>)}</nav><ViewTransition enter="page-enter" exit="page-exit"><div className="route-content">{children}</div></ViewTransition></main>{isProfileOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsProfileOpen(false)}><section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="icon-button profile-close" onClick={() => setIsProfileOpen(false)} aria-label="Закрыть"><X size={20} /></button>{isLoadingProfile ? <p className="profile-loading">Загружаем профиль...</p> : isEditing ? <form onSubmit={saveProfile}><div className="profile-heading"><p className="eyebrow">Твои данные</p><h2 id="profile-title">Редактировать профиль</h2></div><label className="profile-avatar-editor">{profile.avatarUrl ? <Image src={profile.avatarUrl} alt="Аватар" width={76} height={76} unoptimized /> : <span>{initials}</span>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} /><small>Изменить аватар</small></label><label>Имя<input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} required /></label><label>О себе<textarea value={profile.about} onChange={(event) => setProfile((current) => ({ ...current, about: event.target.value }))} maxLength={500} /></label><label>Мои предпочтения в книгах<textarea value={profile.preferences} onChange={(event) => setProfile((current) => ({ ...current, preferences: event.target.value }))} maxLength={500} /></label>{profileError && <p className="profile-error" role="alert">{profileError}</p>}<button className="submit-button" type="submit">Сохранить изменения</button></form> : <><div className="profile-summary"><div className="profile-avatar">{profile.avatarUrl ? <Image src={profile.avatarUrl} alt="Аватар" width={76} height={76} unoptimized /> : initials}</div><div><p className="eyebrow">Твой профиль</p><h2 id="profile-title">{profile.name || "Добавь имя"}</h2><p>{profile.email}</p></div></div><div className="profile-data"><strong>О себе</strong><p>{profile.about || "Добавь несколько слов о себе."}</p><strong>Мои предпочтения в книгах</strong><p>{profile.preferences || "Расскажи, что тебе нравится читать."}</p></div>{profileError && <p className="profile-error" role="alert">{profileError}</p>}<button type="button" className="profile-edit" onClick={() => setIsEditing(true)}><Pencil size={17} /> Редактировать</button><button type="button" className="profile-signout" onClick={signOut}><LogOut size={17} /> Выйти</button></>}</section></div>}</LibraryProvider>;
}