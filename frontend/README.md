# 思考の樹形図 — フロントエンド（React + TypeScript + Vite）

`prototype/` から昇格したフロントエンド。`prototype/` はモック比較（案1〜6）の履歴として残してある。

## 起動手順

**バックエンドを先に起動しておくこと。** フロントは 5173、API は 8000 の**別オリジン**で動き、Sanctum の SPA cookie 認証で繋がる。

```bash
# 1) API（別ターミナル。PHP 8.4 必須）
cd ../api
/opt/homebrew/opt/php@8.4/bin/php artisan serve   # → http://localhost:8000

# 2) フロント
npm install
npm run dev                                        # → http://localhost:5173
```

`npm run build` で型チェック（`tsc -b`）＋本番ビルド。

## 設定

`.env`（`.env.example` をコピー）:

| 変数 | 既定値 | 説明 |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8000` | Laravel API のオリジン |

`VITE_API_URL` を変えた場合は、**API 側の `FRONTEND_URL` と `SANCTUM_STATEFUL_DOMAINS` も合わせる**こと（合っていないと CORS で弾かれるか、cookie 認証が効かない）。

## 構成

```
src/
  api/client.ts      Sanctum SPA cookie 認証の作法を集約した fetch ラッパ
  api/types.ts       バックエンド Resource に対応する型
  auth/AuthContext   認証状態（loading / authenticated / guest）と login/register/logout
  auth/guards.tsx    RequireAuth / RequireGuest（ルートガード）
  pages/             LoginPage / RegisterPage / MainPage
  layouts.tsx        案1〜6。**採用は Layout6**（左テーマ／中央チャット／右マインドマップ）
  store.tsx          プロトタイプ由来のインメモリ store（※実データ接続は次スライス）
  components/        ChatPanel / ThemeSidebar / trees/*
```

## 現在の状態（Step6 スライス1 時点）

- ✅ サインアップ / ログイン / ログアウト / リロードでのセッション復元
- ⏳ メイン画面はまだ**プロトタイプのダミーデータ**で動いている（実 API 接続は次スライス）

## 既知の事項

- `react-router-dom` は 7.18.1 に固定。`npm audit` に RSC モードの CSRF 脆弱性が1件出るが、**本アプリはクライアント専用SPAで RSC / server action を使わないため該当しない**。旧版 7.11.0 は逆に `<Link>`/`useNavigate` のオープンリダイレクトなど14件を抱えるため、ダウングレードしないこと。
