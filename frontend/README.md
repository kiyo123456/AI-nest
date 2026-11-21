# 思考の樹形図 — フロントエンド（React + TypeScript + Vite）

`prototype/` から昇格したフロントエンド。`prototype/` はモック比較（案1〜6）の履歴として残してある。

## 起動手順

**バックエンドを先に起動しておくこと。** フロントは 5173、API は 8000 の**別オリジン**で動き、Sanctum の SPA cookie 認証で繋がる。

```bash
# 1) API（別ターミナル。PHP 8.4 必須）
cd ../api
/opt/homebrew/opt/php@8.4/bin/php artisan serve   # → http://localhost:8000

# 2) フロント
pnpm install
pnpm dev                                        # → http://localhost:5173
```

`pnpm build` で型チェック（`tsc -b`）＋本番ビルド。

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
  api/queries.ts     TanStack Query のフック（projects / nodes / messages / path）
  api/types.ts       バックエンド Resource に対応する型
  auth/AuthContext   認証状態（loading / authenticated / guest）と login/register/logout
  auth/guards.tsx    RequireAuth / RequireGuest（ルートガード）
  selection/         今どのテーマ・どのノードを見ているか（クライアント状態）
  tree.ts            フラットなノード配列から木を組み立てるヘルパ
  pages/             LoginPage / RegisterPage / MainPage
  layouts.tsx        Layout6（採用案：左テーマ／中央チャット／右マインドマップ）
  components/        ChatPanel / ThemeSidebar / trees/MindMap
```

**状態の使い分け**: サーバーが持つデータ（テーマ・ノード・発話）は TanStack Query が
キャッシュし、UI の関心事（選択中のテーマ／ノード）は `selection/` の Context が持つ。
比較検討した案1〜5とその他のツリー表現は `prototype/` に残してある。

## 現在の状態（Step6 スライス3 時点）

- ✅ サインアップ / ログイン / ログアウト / リロードでのセッション復元
- ✅ メイン画面が実 API で動く（テーマ一覧・ツリー・発話・パンくず・切替）
- ✅ **書き込み操作**: テーマ作成（根ノードも自動生成）／チャット送信（楽観的更新）／
  AI回答から「ここから枝を作る」
- ⏳ マインドマップの pan/zoom（@xyflow/react への置換）は次スライス

**チャット送信には API 側の `ANTHROPIC_API_KEY` が必要**（従量課金）。未設定の場合は
502 エラーが表示されるが、**送った発話はサーバーに保存されたまま残る**（学習履歴を
失わない設計）。

### 動作確認用のデータ

API 側でシーダーを流すと、デモ用アカウントと分岐のある学習ツリーが入る。

```bash
cd ../api && /opt/homebrew/opt/php@8.4/bin/php artisan db:seed
```

ログイン: `demo@example.com` / `password`（既存アカウントは削除されない）

## 既知の事項

- `react-router-dom` は 7.18.1 に固定。`npm audit` に RSC モードの CSRF 脆弱性が1件出るが、**本アプリはクライアント専用SPAで RSC / server action を使わないため該当しない**。旧版 7.11.0 は逆に `<Link>`/`useNavigate` のオープンリダイレクトなど14件を抱えるため、ダウングレードしないこと。
