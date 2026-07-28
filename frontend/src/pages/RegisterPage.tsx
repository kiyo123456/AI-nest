import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiValidationError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiValidationError) {
        setErrors(error.errors);
      } else {
        setFormError(
          error instanceof Error ? error.message : "登録に失敗しました。",
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
        <p className="auth-lead">アカウントを作成して学習の樹を育てましょう。</p>

        {formError && <p className="auth-alert">{formError}</p>}

        <label className="auth-field">
          <span>名前</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          {errors.name && <em className="auth-error">{errors.name[0]}</em>}
        </label>

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
            autoComplete="new-password"
            required
          />
          {errors.password && (
            <em className="auth-error">{errors.password[0]}</em>
          )}
        </label>

        <label className="auth-field">
          <span>パスワード（確認）</span>
          <input
            type="password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "登録中…" : "サインアップ"}
        </button>

        <p className="auth-switch">
          すでにアカウントがある場合は <Link to="/login">ログイン</Link>
        </p>
      </form>
    </div>
  );
}
