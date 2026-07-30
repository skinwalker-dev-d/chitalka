"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/actions/auth";

export function AuthForm() {
  const [isRegistration, setIsRegistration] = useState(false);
  const [state, action, pending] = useActionState(isRegistration ? signUp : signIn, {});
  return <main className={isRegistration ? "auth-page is-registration" : "auth-page"}><form className="auth-form" action={action}><p className="eyebrow">Личная библиотека</p><h1>{isRegistration ? "Создать аккаунт" : "С возвращением"}</h1>{isRegistration && <label>Имя<input name="name" autoComplete="name" required /></label>}<label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Пароль<input name="password" type="password" autoComplete={isRegistration ? "new-password" : "current-password"} minLength={8} required /></label>{isRegistration && <label>Повторите пароль<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required /></label>}{state.error && <p className="auth-error" role="alert">{state.error}</p>}<button className="submit-button" disabled={pending} type="submit">{isRegistration ? "Зарегистрироваться" : "Войти"}</button><button className="auth-switch" type="button" onClick={() => setIsRegistration((current) => !current)}>{isRegistration ? "Уже есть аккаунт" : "Регистрация"}</button></form></main>;
}