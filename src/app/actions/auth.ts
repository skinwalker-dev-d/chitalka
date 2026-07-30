"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { error?: string };
const credentials = z.object({ email: z.email(), password: z.string().min(8) });
const registrationPasswords = z.object({ password: z.string().min(8), passwordConfirmation: z.string().min(8) }).refine((values) => values.password === values.passwordConfirmation, { message: "Пароли не совпадают.", path: ["passwordConfirmation"] });

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Неправильный Логин или Пароль, пожалуйста, проверьте правильность написания и попробуйте еще раз" };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: "Неправильный Логин или Пароль, пожалуйста, проверьте правильность написания и попробуйте еще раз" };
  } catch { return { error: "Авторизация пока не настроена. Добавь переменные Supabase в .env.local." }; }
  redirect("/");
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const passwords = registrationPasswords.safeParse({ password: formData.get("password"), passwordConfirmation: formData.get("passwordConfirmation") });
  if (!name) return { error: "Укажи имя." };
  if (!passwords.success) return { error: passwords.error.issues[0]?.message ?? "Проверь пароли." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({ email, password: passwords.data.password, options: { data: { display_name: name } } });
    if (error) return { error: "Не удалось зарегистрироваться. Попробуй другой email." };
  } catch { return { error: "Авторизация пока не настроена. Добавь переменные Supabase в .env.local." }; }
  redirect("/");
}