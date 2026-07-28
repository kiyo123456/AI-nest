import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiValidationError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiValidationError) {
        setErrors(error.errors);
      } else {
        setFormError(
          error instanceof Error ? error.message : "ログインに失敗しました。",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">思考の樹形図</h1>
        <p className="auth-lead">ログインして学習の樹を続けましょう。</p>

        {/* Explains an unasked-for redirect: without it, being thrown back
            here mid-conversation just looks like the app broke. */}
        {sessionExpired && !formError && (
          <p className="auth-alert">
            セッションの有効期限が切れました。もう一度ログインしてください。
          </p>
        )}
        {formError && <p className="auth-alert">{formError}</p>}

        <label className="auth-field">
          <span>メールアドレス</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {errors.email && <em className="auth-error">{errors.email[0]}</em>}
        </label>

        <label className="auth-field">
          <span>パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {errors.password && (
            <em className="auth-error">{errors.password[0]}</em>
          )}
        </label>

        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </button>

        <p className="auth-switch">
          アカウントがまだない場合は <Link to="/register">サインアップ</Link>
        </p>
      </form>
    </div>
  );
}
