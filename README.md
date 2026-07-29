# 思考の樹形図

**AI との学習対話を「木」として残し、深掘りと脱線で見失った現在地に、いつでも戻れるようにする Web アプリ。**

> AI 学習では深掘りと脱線で文脈が枝分かれし、元々何を学んでいたか見失う。紙のメモは負担。だから探索過程を木構造として残し、いつでも元の枝に戻れ、かつ「自分で構造化する行為」で理解も深まるツールを作った。

React + TypeScript の SPA と Laravel の自作 REST API を分離構成で組み、Sanctum の cookie 認証・自作の再帰CTE・Anthropic API 連携までを実装したフルスタック個人開発です。

---

## 解いている課題

Laravel の Eloquent を調べていたら DB の低レイヤーへ次々と潜行し、最初の「Laravel の DB が知りたい」に戻れなくなった、という実体験が出発点です。

| | 痛み |
|---|---|
| **A** | **来た道を見失う。** 深掘り（同じ分野を潜る）と脱線（領域をまたぐ）の両方で文脈が枝分かれし、現在地が分からなくなる |
| **B（本質）** | **知識の全体像＝地図を持っていない。** だから「潜りすぎ」「脱線」に自分で気づけない |

痛みAには**木構造として履歴を残すこと**、痛みBには**その木を俯瞰できる地図にすること**で答えています。

### 中核となる体験

1. チャットで AI に質問する（左：学習テーマ／中央：チャット／右：マインドマップ）
2. 話が逸れたと感じたら、その AI 回答から「**ここから枝を作る**」——新しいノードが生えて会話がそこへ移る
3. マインドマップやパンくずから**元の枝に戻る**。会話はノードごとに保存されているので続きから再開できる

**枝は自動では作られません。** 自分の手で構造化する行為そのものに学習効果がある、という判断からの手動分岐です（AI による枝の提案は発展課題として設計だけ残し、実装は見送りました）。

---

## アーキテクチャ

```mermaid
graph LR
    subgraph Browser
        SPA["frontend/<br/>React 18 + TypeScript + Vite<br/>TanStack Query / @xyflow/react"]
    end
    subgraph Server
        API["api/<br/>Laravel 13 + PHP 8.4<br/>自作 REST API"]
        DB[("MySQL")]
    end
    Anthropic["Anthropic API<br/>(Claude)"]

    SPA -- "cookie 認証 + CORS<br/>5173 → 8000" --> API
    API --> DB
    API -- "サーバー側のみ<br/>キーはフロントに出さない" --> Anthropic
```

開発中はフロントとバックエンドを**別オリジンのまま**繋いでいます。cookie 認証・CORS・CSRF の経路を常に通した状態で開発するためで、Vite の dev proxy はあえて使っていません。

（本番はこの逆で、Static Site の rewrite により**同一オリジン**に見せています。サードパーティ Cookie がブロックされる環境でもログインできるようにするためです。→ [デプロイ](#デプロイrender)）

### 技術選定

| 領域 | 選択 | 選んだ理由（要約） |
|---|---|---|
| フロント | React 18 + TypeScript + Vite | SPA として画面遷移とキャッシュを自前で持つ構成にするため |
| サーバー状態 | TanStack Query | **サーバーの真実**（キャッシュ）と**UIの関心事**（今どこを見ているか）を分離できる |
| マインドマップ | @xyflow/react | pan/zoom・初期フィット・座標変換が実績のある実装で手に入る。**レイアウト計算は自前のまま**残した |
| AI 回答の描画 | react-markdown（+ remark-gfm / rehype-highlight） | 既定で生 HTML を DOM にしないので、**何もしないことが安全側**になる。サニタイズの責任を自分で負う構成を避けた |
| バックエンド | Laravel 13 / PHP 8.4 | 自作 REST API・認可・DB モデリングを一通り実践するため |
| 認証 | Sanctum SPA cookie セッション | HttpOnly Cookie で XSS 耐性。CORS・CSRF・SameSite まで含めて理解する狙い |
| DB | MySQL 8（開発）/ PostgreSQL（本番） | 再帰CTE が使える。ツリーは隣接リストで保持。CTE を標準 SQL の範囲で書いたので、本番の Postgres 移行はクエリ無変更で済んだ |
| AI | Anthropic 公式 PHP SDK | `AnthropicClient` でラップし、乗り換えコストを1ファイルに閉じ込めた |

---

## データモデル

```mermaid
erDiagram
    USER ||--o{ PROJECT : owns
    PROJECT ||--o{ NODE : contains
    NODE ||--o{ MESSAGE : has
    NODE ||--o{ NODE : "parent-child(自己参照)"
    MESSAGE ||--o{ NODE : "branch point(分岐元の発話)"
```

- **ツリーは隣接リスト（`parent_id`）＋ 再帰CTE**。枝の追加が頻繁でツリー自体は小さいため、挿入が軽い隣接リストを選択。祖先パスの取得だけ `WITH RECURSIVE` で1クエリにしています
- **分岐点は `branch_from_message_id`（messages への FK）**。位置（index）ではなく**発話の同一性**で指すので、メッセージの編集・削除でズレません
- **AI に送る文脈の復元**: 対象ノードから根まで辿り、各ノードで「**その子が分岐した発話まで**」の messages を連結します。これにより脱線側・分岐後の発話は混ざりません

---

## セットアップ

### 必要なもの

- **PHP 8.4**（⚠️ `php` が 8.2 に解決される環境では Composer が拒否します。`/opt/homebrew/opt/php@8.4/bin/php` のようにフルパスで実行してください）
- MySQL 8 / Node.js 20+
- Anthropic の API キー（チャット機能を使う場合のみ。**従量課金**）

### 起動

```bash
# 1) バックエンド
cd api
cp .env.example .env
# .env の DB 接続と ANTHROPIC_API_KEY を設定
composer install
/opt/homebrew/opt/php@8.4/bin/php artisan key:generate
/opt/homebrew/opt/php@8.4/bin/php artisan migrate
/opt/homebrew/opt/php@8.4/bin/php artisan db:seed   # デモデータ（追加的・既存データは消えません）
/opt/homebrew/opt/php@8.4/bin/php artisan serve     # → http://localhost:8000
```

```bash
# 2) フロントエンド（別ターミナル）
cd frontend
npm install
npm run dev                                          # → http://localhost:5173
```

デモアカウント: `demo@example.com` / `password`

> チャット送信は Anthropic API を実際に呼ぶため課金されます。枝作成・テーマ作成・ツリー操作はキーなしで動きます。

### テスト

```bash
cd api && /opt/homebrew/opt/php@8.4/bin/php artisan test
```

**68件**（Pest）。AI 呼び出しは自作ラッパをモックするので、テストは常に課金ゼロです。

---

## デプロイ（Render）

[`render.yaml`](render.yaml) の Blueprint で、API（Docker の Web Service）と SPA（Static Site）を一度に定義しています。

```mermaid
graph LR
    Browser["ブラウザ"]
    subgraph Render
        Web["Static Site<br/>frontend/dist"]
        API["Web Service (Docker)<br/>nginx + php-fpm 8.4"]
    end
    Neon[("Neon<br/>PostgreSQL")]

    Browser --> Web
    Web -- "rewrite<br/>/api/* · /sanctum/*" --> API
    API --> Neon
```

### 設計判断

| 論点 | 決定 | 理由 |
|---|---|---|
| API の実行形態 | **Docker**（`api/Dockerfile`） | Render に PHP のネイティブランタイムが無い。土台は `serversideup/php:8.4-fpm-nginx`（nginx + php-fpm + Laravel 向け起動処理が揃い、`pdo_pgsql` 同梱） |
| フロント→API の経路 | **Static Site の rewrite でプロキシ** | 別ドメインで直接叩くと Sanctum のセッション Cookie が**サードパーティ扱い**になり、Safari 等ではログインできない。rewrite ならブラウザからは同一オリジンなので、Cookie はファーストパーティのまま・CORS も発生しない |
| 本番 DB | **PostgreSQL（Neon）** | Render に MySQL のマネージド DB は無く、無料 Postgres は作成30日で失効する。`ancestorPath()` の `WITH RECURSIVE` は標準 SQL でマイグレーションもポータブルだったため、**クエリを一行も変えずに**移行できた |
| キャッシュ整備 | **起動時に実行**（`AUTORUN_LARAVEL_*`） | `config:cache` をビルド時に走らせるとビルド時の空の env が焼き込まれる。実行時の env が揃う起動時に回す |
| デモデータ投入 | **entrypoint スクリプト** | 無料プランには Render Shell が無く、デプロイ後に `db:seed` を手で叩けない。シーダーは冪等なので毎起動走っても増えない |

> 副産物として、`messages.content` が MySQL TEXT の 65,535 バイト上限から外れました（PostgreSQL の TEXT は無制限）。`ANTHROPIC_MAX_TOKENS` を上げても列があふれません。

### 手順

1. **Neon** で無料プロジェクトを作り（リージョンは Render に合わせて Singapore）、接続文字列を控える
2. `APP_KEY` を生成して控える — `cd api && php artisan key:generate --show`
3. Render → **New → Blueprint** → このリポジトリを接続
4. `sync: false` の3つ（`APP_KEY` / `DB_URL` / `ANTHROPIC_API_KEY`）をダッシュボードで入力
5. 初回デプロイ後、確定した URL で `render.yaml` の `<<API_URL>>` / `<<WEB_URL>>` を置き換えて push
   （rewrite の destination には Render の**外部 URL** が必要。内部ドメインは 502 になる）

### 無料プランの制約

- **コールドスタート**: 15分無アクセスでスピンダウンし、復帰に約50秒。初回アクセスは待たされる
- **AI 応答のタイムアウト**: チャットは Claude を同期呼び出しするため、コールドスタートと重なると
  ゲートウェイタイムアウトの可能性がある
- **Neon**: アイドル時はスケールゼロ（復帰は1秒未満）、ストレージ 0.5GB

---

## ドキュメント

| | 内容 |
|---|---|
| **[api/README.md](api/README.md)** | **設計判断ログ。** 各スライスで「なぜそれを選んだか / どこで詰まったか / トレードオフ」を記録しています。**最初に読むならここ** |
| [PLAN.md](PLAN.md) | 全体設計の正本。課題定義からデータモデリングまで Phase1〜7 |
| [CHECKLIST.md](CHECKLIST.md) | 実装タスクと日付順のセーブポイント |
| `prototype/` | 画面設計の比較モック（案1〜6）。採用したのが案6のマインドマップ型 |

### 進め方

このプロジェクトは次のループで進めました。

> **技術選定（選択肢とトレードオフを本人が言語化して決定）→ AI が実装 → 本人がコードを読んでレビュー → 判断を記録**

単位は「スライス」＝レビューできる粒度の薄い縦切りです。git の履歴も設計判断ログもスライス単位で対応しています。実装できたことより、**なぜその実装を選んだかを説明できること**を目的にしています。
