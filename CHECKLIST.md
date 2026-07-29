# 思考の樹形図 — 実装チェックリスト

> 進め方: **技術選定（本人）→ AIが実装 → 本人がコードを読んでレビュー・評価 → 判断を自分の言葉で記録**。
> 「スライス」単位で積み、各スライスで Lv1〜3（選択理由/失敗と判断/トレードオフ）を語れる状態を担保する。
> 詳しい設計判断の背景は [PLAN.md](PLAN.md)（＝正本）を参照。

## 確定スタック（前提）

- フロント: React + TypeScript + Vite（SPA） / マインドマップは @xyflow/react
- バックエンド: Laravel 13（PHP 8.4）で自作 REST API ※`/opt/homebrew/opt/php@8.4/bin/php` を使う
- 認証: Laravel Sanctum（方式＝トークン or SPA cookie は Step3 で選定）
- DB: MySQL（nodes は隣接リスト `parent_id` ＋ 再帰CTE / 分岐点は `branch_from_message_id`＝messages への FK）
- AI: サーバ側から Anthropic/OpenAI を呼ぶ（キーは `.env`）

---

## 0. セットアップ前提

- [x] ディスク空き容量を確保（約11GB。逼迫は解消）✅
- [x] モノレポ構成を作る: `frontend/`（Vite React, prototype を昇格） / `api/`（Laravel） ✅ 2026-07-26（Step6-1。`prototype/` は比較モックとして保全）

## 1. バックエンド土台（Laravel）

- [x] `laravel new api`（Noneスターターキット / Pest）✅ 2026-06-07
- [x] `.env` で MySQL 接続設定、DB 作成（DB名: `nest`）✅
- [x] Laravel Sanctum 導入（`php artisan install:api`）✅ 2026-07-22（Sanctum v4）

## 2. DB（マイグレーション・モデル）

- [x] migration: `users`(標準) / `projects` / `nodes`(自己参照) / `messages` ✅
- [x] migration: `nodes.branch_from_message_id`（messages への FK / nullOnDelete）を後付けで追加 ✅ 2026-07-17
- [x] Eloquent モデル＋リレーション ✅ 2026-07-17
  - [x] `Project hasMany Node` / `Project belongsTo User` / `User hasMany Project`
  - [x] `Node belongsTo parent` / `Node hasMany children`（同一 `parent_id` の逆向き参照）
  - [x] `Node hasMany Message` / `Message belongsTo Node`
  - [x] `Node belongsTo branchFromMessage`（分岐元の発話）
- [x] factory 3件（Project / Node / Message）＋ リレーションの feature test 5件 ✅
- [x] シーダーでダミーデータ（A→B/C 分岐を1本作り分岐点の動作を確認できる形に）✅ 2026-07-27 `LearningTreeSeeder`（追加的・テスト4件）

## 3. 認証（Sanctum）✅ 完了 2026-07-22

- [x] 技術選定: トークン方式 vs SPA cookie 方式 → **SPA cookie セッション方式**を採用（根拠は `api/README.md` 設計判断ログ）✅
- [x] `php artisan install:api`（Sanctum 導入 ＋ `routes/api.php` 生成 ＋ `personal_access_tokens` migrate）✅
- [x] register / login / logout / me エンドポイント（薄いコントローラ＋FormRequest＋UserResource）✅
- [x] CORS と SPA セッション設定（`statefulApi()` / `supports_credentials` / `SANCTUM_STATEFUL_DOMAINS` / `SESSION_DOMAIN`）✅
- [x] feature test 8件（register/login/logout/me の成功・失敗・401）。`php artisan test` は **全15件緑** ✅

## 4. 自作REST API（CRUD＋認可）

- [x] projects: index / store / show / update / destroy（自分の所有のみ。削除はプロジェクト単位）✅ 2026-07-25（スライス1）
- [x] nodes: store(枝作成: `parent_id`, `branch_from_message_id`) / index / show / update / destroy ✅ 2026-07-25（スライス2）※destroyは**葉ノードのみ可**（子持ちは409）で PLAN の矛盾を整合
- [x] messages: store(ノードに発話追加) / index ✅ 2026-07-25（スライス2）
- [x] ルート→ノードのパス取得API（再帰CTE）✅ 2026-07-26 `Node::ancestorPath()`＋`GET /nodes/{node}/path`
- [x] Policy で所有者チェック ※`ProjectPolicy`（403）＋`NodePolicy`（node→project→user で導出、messagesもNodePolicyに集約）✅

## 5. AI連携（サーバ側）

- [x] `ContextBuilder`: 根まで `parent_id` を辿り、各ノードで「その子の `branch_from_message_id` まで」の messages を連結 ✅ 2026-07-26 `App\Services\ContextBuilder`＋`GET /nodes/{node}/context`
- [x] Anthropic を**公式PHP SDK `anthropic-ai/sdk`** で呼ぶ（キーは `.env`／`config/services.php`。`AnthropicClient` でラップ）✅ 2026-07-26
- [x] 回答を `messages` に保存して返す（`POST /api/nodes/{node}/chat`／同期）✅ 2026-07-26

## 6. フロント（React SPA）

> 大きすぎるため**4スライスに分割**（レビューできる粒度で積む原則）。

**6-1 土台＋認証** ✅ 完了 2026-07-26
- [x] prototype を `frontend/` に昇格（**コピー**。git 未導入のため移動は避けた）、`npm install`（Vite+React18+TS）✅
- [x] API クライアント（fetch、Sanctum SPA cookie 対応。`credentials:'include'`＋CSRF）✅ `src/api/client.ts`
- [x] 認証画面（サインアップ/ログイン）＋API連携、認証状態管理（`loading/authenticated/guest`）✅
- [x] React Router 導入＋ルートガード（未認証は `/login` へ）✅
- [x] **ブラウザ実機で検証**（リロードでセッション復元＝Step3のcookie認証が動く証明）✅

**6-2 メイン画面を実データに接続** ✅ 完了 2026-07-27
- [x] メイン画面(案6)：左テーマ / 中央チャット / 右マインドマップ、開閉・全画面 ✅ 実APIに接続済み
- [x] projects/nodes/messages 取得、ノード/テーマ切替、パンくず（`GET /nodes/{id}/path`）✅ TanStack Query
- [x] 案1〜5（`layouts.tsx` の Layout1〜5・`trees/` の未採用3種）を整理 ✅ `store.tsx`/`data.ts` も削除

**6-3 チャットと枝作成** ✅ 完了 2026-07-28
- [x] チャット送信→`POST /nodes/{node}/chat`→AI回答表示 ✅ 楽観的更新。**実キーで1回実送信して検証済み**
- [x] 「ここから枝を作る」→ nodes API で子ノード生成→ツリー更新 ✅ タイトルはユーザー入力
- [x] テーマ作成（`POST /projects` ＋ 根ノード生成）✅ 6-2 で保留した「根ノードは誰が作るか」をフロント側に決定
- [x] ⚠️ `branchFromIndex`（位置）→ `branch_from_message_id`（メッセージID）✅ **6-2 で `store.tsx`/`data.ts` を削除した時点で解消**（新実装は最初からID基準）

**6-4 マインドマップ強化** ✅ 完了 2026-07-28
- [x] マインドマップを @xyflow/react で pan/zoom 対応に置換 ✅ 座標計算は自前（`layoutTree`）のまま、見た目は完全維持

## 7. 仕上げ（非機能・任意）

> スライスに分割。**7-3 完了**。

**7-1 センタリング＋N+1** ✅ 完了 2026-07-28
- [x] 選択ノードを自動で画面に入れる（**画面外のときだけ**寄せる／倍率は変えない）✅ `CenterOnSelection`
- [x] N+1チェック（eager load `with`）✅ 全経路を調査 → 本物は `ContextBuilder` の1件のみ。**深さ3で4本・深さ8で9本 → どちらも2本**に。クエリ本数を assert するテストで固定

**7-2 バリデーション・エラーハンドリング** ✅ 完了 2026-07-28
- [x] `content` の `max:` 上限（**10,000文字**。MySQL `TEXT` は 65,535 **バイト**＝日本語で約21,800文字）✅ 文言も `messages()` で日本語化
- [x] **課金される `POST /nodes/{node}/chat` にレート制限**（**1分1回＋1日50回**・ユーザー単位・`.env` で変更可）✅
- [x] セッション切れの 401 をフロントで捕まえて `/login` へ ✅ `client.ts` に集約。**起動時の `/me` 401 で誤発火しない**ようガード
- [x] `config/cors.php` の `exposed_headers` に `Retry-After`（CORS が隠していて待ち秒数を出せなかった）✅

**7-3 AI 回答の Markdown 描画** ✅ 完了 2026-07-28
- [x] AI 回答を Markdown として描画（`react-markdown` + `remark-gfm` + `rehype-highlight`）✅ 生 HTML は無効のまま
- [x] **改行が潰れていた**のを直す（`.bubble` に `white-space: pre-wrap`）✅ Markdown 以前の欠陥
- [x] AI 回答は吹き出しをやめて全幅の「読み物」に、ユーザー発話は吹き出しのまま ✅ Claude/ChatGPT と同じ組み方
- [x] コードブロック・表がペインを押し広げないよう `min-width: 0` 3箇所 ＋ 内側スクロール ✅
- [x] `SYSTEM_PROMPT` に「Markdown で構造化」を1行（**内容量に見合う範囲で**を明記）✅

**7-4 以降**
- [x] README に設計判断（隣接リスト採用理由・ハイブリッド分岐など）を記述＝ポートフォリオ用 ✅ `api/README.md` の設計判断ログとして各スライスで継続記録
- [ ] (発展) C案: AIが話題転換を検知して枝を提案

---

## 進捗メモ（自由記入）

### 2026-06-07 セーブポイント
- `laravel new api` 完了（スターターキット: None / 認証: なし / テスト: Pest）
- プロジェクト名は `api/`（`backend/` ではなく）

### 2026-07-17 セーブポイント（Step1・Step2 完了）
- **進め方を転換**: 「本人主導で実装」→「技術選定は本人 / AIが実装 / 本人がレビュー・評価して記録」。詳細は [PLAN.md](PLAN.md) Phase7。
- **Step1 完了**: `nodes.branch_from_message_id`（messages への FK・nullable・nullOnDelete）を後付けマイグレーションで追加、`migrate` 済み。
  - 3案（nullOnDelete / restrict / cascade）を比較し nullOnDelete を採用。プロジェクト単位削除のカスケードが通ることを実データで検証済み。
- **Step2 完了**: `Project` / `Node` / `Message` モデル＋リレーション、factory 3件、feature test 5件。`php artisan test` は 7件緑（13アサーション）。
- **環境の罠 ⚠️**: `php` は 8.2.28 に解決され Composer(`>= 8.4.1`) が拒否して artisan が落ちる。
  → **`/opt/homebrew/opt/php@8.4/bin/php artisan ...` を使う**（8.4.5）。
- DB は `nest`（MySQL / root / パスワードなし）。テストは SQLite `:memory:` なので開発DBは汚れない。
- **次にやること:** 「3. 認証（Sanctum）」。まず **トークン方式 vs SPA cookie 方式**の選定を壁打ちで決め、根拠を `api/README.md` の設計判断ログに記録してから実装。

参考: https://zenn.dev/taroosg/articles/20241230213417-f57c3c32e613db

### 2026-07-22 セーブポイント（Step3 認証 完了）
- **技術選定（本人）**: SPA cookie セッション方式を採用（vs Bearer トークン）。根拠＝Web SPA 単一クライアント前提／HttpOnly Cookie で XSS 耐性／CORS・CSRF・SameSite まで語れる。詳細は `api/README.md` 設計判断ログ。
- **実装**: `install:api`（Sanctum v4）→ `bootstrap/app.php` に `statefulApi()`、`config/cors.php` を publish して `supports_credentials=true`＋`allowed_origins`=`FRONTEND_URL`、`.env` に `SANCTUM_STATEFUL_DOMAINS`／`SESSION_DOMAIN=localhost`、`User` に `HasApiTokens`。
- **エンドポイント**: `POST /api/register`・`POST /api/login`（ゲスト）／ `GET /api/me`・`POST /api/logout`（`auth:sanctum`）。FormRequest（`LoginRequest::authenticate()` にレート制限）＋ `UserResource`。
- **テスト 8件緑**（全15件）。**罠2つ**: ①`statefulApi()` は Origin が stateful ドメインの時だけセッションを差し込む → テストは `beforeEach` で Origin を付与。②`actingAs` はガードを固定するため logout は 204 契約のみ検証し、401 は別テストで担保。
- **次にやること:** 「4. 自作REST API（CRUD＋認可）」。まず projects の index/store/update/destroy ＋ Policy（所有者チェック）から。`frontend/` 昇格（Step6）はまだ。

### 2026-07-25 セーブポイント（Step4 スライス1: projects CRUD 完了）
- **技術選定（本人）**: 認可＝**Policy クラス方式（他人のは 403）**を採用。範囲は**projects CRUD のみ**の薄い縦スライス。ルートのネスト方針は nodes スライスで選定するため保留。根拠・トレードオフ（403は存在漏洩／404隠蔽・スコープ併用）は `api/README.md` 設計判断ログ。
- **実装**: `ProjectPolicy`（view/update/delete＝所有者判定, viewAny/create＝true）、ベース `Controller` に `AuthorizesRequests`（Laravel11+ で `authorizeResource` が効かないため明示 `authorize()`）、`ProjectController`（apiResource）、`Store/UpdateProjectRequest`、`ProjectResource`（`whenCounted`）、`Route::apiResource('projects', ...)` を `auth:sanctum` 内に追加。
- **要点**: 一覧は Policy で絞れないので `user()->projects()->withCount('nodes')` でスコープ＋N+1回避。削除は project 単位のみ＝配下 nodes/messages は FK cascade（テストで実証）。
- **テスト 10件緑**（全25件）: 未認証401 / 一覧は自分の分だけ＋nodes_count / 作成201・所有者付与 / バリデーション422 / show・update・destroy の所有200系＋**他人は403** / **cascade削除**。
- **未解決（記録）**: PLAN「削除はプロジェクト単位＝唯一の削除経路」と CHECKLIST の `nodes: destroy` が矛盾。nodes スライスで「node 個別削除を許すか（許すなら子孫カスケード）」を選定して整合する。
- **次にやること:** nodes スライス（枝作成 store: parent_id・branch_from_message_id ＋ NodePolicy）。着手前にルートのネスト方針（`/projects/{project}/nodes` か）を選定。

### 2026-07-25 セーブポイント（Step4 スライス2: nodes + messages 完了）
- **技術選定（本人）**: ①ルート＝**shallow nest**（作成/一覧は親配下、単体はフラット `/nodes/{node}`）②node削除＝**葉ノードのみ可**（子持ちは409。中抜き禁止で履歴保護）③範囲＝nodes + messages 一緒。根拠は `api/README.md` 設計判断ログ。
- **PLAN矛盾を解消**: 「削除はプロジェクト単位＝唯一の削除経路」→「**project単位＋葉ノード個別削除**」に確定し PLAN.md Phase6 も修正。
- **実装**: `NodePolicy`（view/update/delete＝node→project→userで所有権導出）、`NodeController`（apiResource shallow: index/store は親Projectを認可、show/update/destroy は NodePolicy、destroyは`children()->exists()`で409）、`MessageController`（index/store のみ。認可は NodePolicy に集約）、`Store/UpdateNodeRequest`（分岐点のクロスフィールド検証: parent_idは同project内・branch_from_message_idは親スレッド内）、`StoreMessageRequest`（role in:user,assistant）、`Node/MessageResource`（whenCounted）、ルートは `apiResource(...)->shallow()`。
- **テスト 20件緑**（全45件）: nodes13＋messages7。所有権403 / 分岐点422（別project親・親スレッド外message）/ **葉削除204・子持ち409** / role/content 422 / 未認証401 を網羅。
- **次にやること:** ルート→ノードのパス取得API（再帰CTE）＝`ContextBuilder`（根まで parent_id を辿り各ノードの messages を「子の分岐点まで」連結）。これは Step5（AI連携）の直前スライス。

### 2026-07-26 セーブポイント（橋渡し: 祖先パス再帰CTE ＋ ContextBuilder 完了）
- **技術選定（本人）**: パス取得＝**再帰CTE**（vs 全ノード取得してメモリ）。範囲＝パスAPI＋ContextBuilder（AI呼び出しは Step5）。根拠は `api/README.md` 設計判断ログ（なぜパスが要るか＝AI文脈復元＋パンくず）。
- **実装**: `Node::ancestorPath()`（`WITH RECURSIVE` 生SQL、`depth DESC` で根→対象、MySQL/SQLite共通）、`App\Services\ContextBuilder::build()`（各ノード「子の分岐点まで」＋対象は全部、`id`昇順を発話順の根拠に）、`NodeController@path/@context`（`NodePolicy@view`）、`GET /nodes/{node}/path`・`/context`。
- **テスト 6件緑**（全51件）: A→B→D で path=`[A,B,D]`・context=`[a1,a2,b1,b2,d1,d2]`（分岐後の a3/b3 除外）、根ノード単体、未認証401・他人403。**再帰CTEが SQLite で通ることも実証**。
- **次にやること:** Step5 本体（AI連携）。ContextBuilder の出力を Anthropic/OpenAI に送り、応答を messages に保存して返す。着手前に「Http ファサード直叩き vs `openai-php/laravel` 等パッケージ」「どのプロバイダ/モデル」を選定。

### 2026-07-26 セーブポイント（Step5 AI連携 完了）
- **技術選定（本人）**: ①**公式PHP SDK `anthropic-ai/sdk`**（vs Http ファサード。依存追加を明示承認）②**Anthropic (Claude)** ③**同期**（vs キュー/ストリーミング）。根拠とトレードオフは `api/README.md` 設計判断ログ。
  - ⚠️ **事実訂正の記録**: 検討中に「Anthropic は PHP 公式SDKを出していない」と誤情報が出たが、**公式PHP SDKは存在する**（無いのは Laravel 専用ラッパー）。訂正のうえ選定し直した。
- **実装**: `AnthropicClient`（SDKをラップする境界。乗り換えコストを1ファイルに閉じ込め）、`AiRequestException`（`render()` で502）、`NodeChatController`（invokable）、`ChatRequest`、`config/services.php` の `anthropic` エントリ、`AppServiceProvider` で SDK クライアントをDI登録、`POST /api/nodes/{node}/chat`。
- **要点**: ユーザー発話を保存→`ContextBuilder`で文脈生成→AI→応答保存→両方を201で返す。**AI失敗時もユーザー発話は残す**（学習履歴＝コアバリュー）。キーはサーバ側のみ。
- **テスト 6件緑**（全57件）: 成功/**文脈が分岐点までであることの検証**/AI失敗で502＋発話は残存/422/403/401。**`AnthropicClient` をモックするので実APIを呼ばず課金ゼロ**。
- **依存追加の責任**: `composer audit` は 9 advisories / 2 packages（`guzzlehttp/guzzle`・`guzzlehttp/psr7`）。**SDK導入前と同数＝新規SDKによる増加はなし**。guzzle 系は既存の課題として別途対応。
- **次にやること:** Step6（フロント React SPA）。`prototype/` を `frontend/` に昇格 → 認証画面 → APIクライアント（Sanctum cookie対応）→ 3ペイン画面 → @xyflow/react。**未実施**: `.env` に実 `ANTHROPIC_API_KEY` を入れての疎通確認（本人）。

### 2026-07-26 セーブポイント（Step6-1 フロント土台＋認証 完了）
- **技術選定（本人）**: ①**直接CORSで叩く**（vs Vite dev proxy）＝Step3の設定を実機検証するため ②**React Router 導入** ③スライスは**6-1のみ**。根拠は `api/README.md` 設計判断ログ。
- **実装**: `frontend/`（`prototype/` からコピー昇格・`prototype/` は温存）、`src/api/client.ts`（Sanctum作法を集約）、`src/api/types.ts`、`src/auth/AuthContext.tsx`＋`guards.tsx`、`src/pages/{Login,Register,Main}Page.tsx`、`App.tsx` をルーター構成に、`styles.css` に認証画面スタイル追記、`tsconfig.json` に `types: ["vite/client"]`。
- **ブラウザ実機で全フロー検証済み**: `/`→`/login` リダイレクト／サインアップ201→`/`／**リロードで `/api/me` 200＝セッション復元**／ログアウト204→`/login`／誤パスワード422をフィールド表示／正パスワード200。**CORSプリフライト(OPTIONS)が204で通り**、コンソールエラーなし。`npm run build` 通過。
- **嵌まりどころ（記録）**: ①`XSRF-TOKEN` cookie は URL エンコード済み→`decodeURIComponent` 必須 ②cookie はポートを区別しないので `SESSION_DOMAIN=localhost` で 5173↔8000 が繋がる ③認証状態に `loading` が無いとログイン画面が一瞬フラッシュする。
- **依存の判断**: `react-router-dom` は **7.18.1 に固定**。7.11.0 へ下げると `<Link>`/`useNavigate` のオープンリダイレクト等**14件**の脆弱性を抱えるため不可。7.18.1 の1件は RSC モード専用で本アプリ（クライアント専用SPA）には該当しない。
- **⚠️ 未対応の課題**: **リポジトリが git 管理されていない**（ルート・`api/`・`frontend/` 全て）。57件のテストを含む成果物がバックアップ無しの状態。
- **次にやること:** 6-2（メイン画面を実データに接続）。

### 2026-07-27 セーブポイント（Step6-2 メイン画面の実データ接続 完了）
- **技術選定（本人）**: ①**TanStack Query 導入**（vs Context自前）②**パンくずは `/path` API**（vs クライアント導出。自作の再帰CTEを実際に使う構成にする）③範囲は**表示＋シーダー**。根拠は `api/README.md` 設計判断ログ。
- **実装（バックエンド）**: `LearningTreeSeeder`＝Phase1の痛みのエピソード（Laravel→Eloquent→クエリ生成→PDO脱線＋マイグレーション別方向）を実データ化。**`firstOrCreate` で追加的**にし既存アカウントを壊さない。テスト4件（分岐構造・`branch_from_message_id` が親スレッドの message を指すこと・4階層パス・二重実行の安全性）。**全61件緑**。
- **実装（フロント）**: `api/queries.ts`（Query フック＋キー設計）、`selection/`（**クライアント状態を分離**）、`tree.ts`（木の組み立て）、3コンポーネントを実データ化、`App.tsx` に `QueryClientProvider`。**削除**: `store.tsx`・`data.ts`・Layout1〜5・未採用ツリー3種。
- **効いた利点**: パンくずとマインドマップが同じ `/path` を要求するが **Query が重複排除して1リクエスト**（ネットワークで確認）。
- **見つけて直したバグ2件（どちらもQuery特有）**: ①`enabled:false` のクエリは永久に `isPending` → 未選択判定を先に置く ②**ユーザー切替で前のユーザーのキャッシュが表示される** → login/register/logout で `queryClient.clear()`。双方向で検証済み。
- **ブラウザ実機で検証**: テーマ2件・5ノード描画・根の自動選択／最深ノードで**パンくず4階層**／テーマ切替／空アカウントの空状態／コンソールエラーなし／`npm run build` 通過。
- **次にやること:** 6-3（チャット送信・枝作成）。

### 2026-07-28 セーブポイント（Step6-3 書き込み系 完了）
- **技術選定（本人）**: ①**楽観的更新**（vs 単純に待つ。AI応答が10〜30秒のため）②**枝のタイトルはユーザー入力**（Phase1「自分の手で構造化する行為が学習効果」と一致）③**実キーで1回だけ実送信して検証**。根拠は `api/README.md` 設計判断ログ。
- **このスライスの肝**: 楽観的更新の**定石（エラー時にロールバック）をあえて外した**。Step5 で「AI失敗時もユーザー発話は保存する」設計にしたため、巻き戻すと画面がサーバーと食い違う。`invalidateQueries` で再取得して真実に合わせる。**バックエンドの設計判断がフロントの定石を変えた例**として語れる。
- **実装**: `api/mutations.ts`（`useSendChat`/`useCreateBranch`/`useCreateProject`）、`ChatPanel`（送信・「考え中…」・インライン枝作成フォーム）、`ThemeSidebar`（インラインテーマ作成）、`<ChatPanel key={selectedNodeId}>`。
- **検証**: 課金ゼロの範囲を先に全部（枝作成→ツリー更新→パンくず1段深く／テーマ作成→根ノード→即会話可能／**502で発話が残る**／ノード切替でリセット）。そのうえで**実キーで1回だけ実送信** → `POST /chat` 201、DBに user/assistant 2件、画面表示まで確認。`artisan test` 61件緑。
- **見つけて直したバグ**: ノード移動後も前のノードのエラーが残る → `key={selectedNodeId}` で remount。
- **途中の詰まり**: 実送信時にセッション切れ（`SESSION_LIFETIME=120分`）で 401。ログインし直して解決。401 時は発話が保存されないため楽観的な発話も消える＝正しい挙動を確認できた。
- **次にやること:** 6-4（マインドマップを @xyflow/react で pan/zoom 対応に置換）。`branchFromIndex`→`branch_from_message_id` 対応を含む。

### 2026-07-28 セーブポイント（Step6-4 マインドマップ pan/zoom 完了 ＝ Step6 完了）
- **技術選定（本人）**: ①**@xyflow/react を導入**（vs 自前で pan/zoom を実装 / 6-4 見送り）②**座標計算は今の自前ロジックを使い回す**（vs dagre / d3-hierarchy）③操作は**パン＋ズーム＋初期全体表示＋ズームボタン**まで（vs ＋ミニマップ / ＋ノードのドラッグ移動）④**見た目は現行のピルを完全維持**。根拠は `api/README.md` 設計判断ログ。
- **このスライスの肝**: **@xyflow/react はレイアウト（座標）を持たない**。「マインドマップのライブラリを入れれば木が描かれる」わけではなく、「ライブラリ導入」と「座標計算」は独立した2つの選定になる。自前の `assign`/`place` を `src/tree.ts` の `layoutTree()` に切り出して使い回し、**木の形は自分のコードが決め、xyflow は描画とビューポートだけ担当する**境界を引いた。
- **実装**: `tree.ts` に `layoutTree()`（純粋関数・左上基準に変換）、`components/trees/PillNode.tsx`（`.mm-pill` のマークアップをカスタムノード化＋左右の不可視 Handle）、`MindMap.tsx` を `<ReactFlow>` に置換（`fitView` / `Controls` / `nodesDraggable={false}` / `key={selectedProjectId}`）、`main.tsx` で xyflow の CSS を自前 CSS より前に import、`styles.css` のエッジ指定を `.react-flow__edge-path` に、`layouts.tsx` の `large` prop を削除。
- **見つけて直したバグ**: ノードが1つだけのテーマで `fitView` がピルを `maxZoom` まで巨大化 →「収める」は「余白があれば拡大する」でもある。初期フィットのみ `maxZoom: 1` で頭打ちにし、手動ズームは 2 まで許す形に分離。
- **嵌まりどころ ⚠️**: **dev サーバ起動中に依存を追加**したら Vite の依存最適化が走り直して React が二重読み込みになり `Invalid hook call` が大量発生。`node_modules/.vite` を消して dev サーバ再起動で解消（コードの問題ではない）。
- **依存追加の責任**: `npm view` の直接依存は3つに見えるが**実際は20パッケージ増**（`@xyflow/system` が d3-zoom / d3-drag 系を連れてくる＝pan/zoom の実体は d3-zoom）。`npm audit` は**導入前と同じ 2 high**（react-router の RSC 専用・該当なしと判断済み）で新規ゼロ。バンドル 426KB（gzip 137KB）。
- **検証（課金ゼロ・実送信なし）**: 変更前は4階層目が右端で切れて見えなかったツリーが、変更後は開いた瞬間に全体が収まる／ドラッグ量と `translate` 差分が一致＝パン正確／ホイールでカーソル中心ズーム／ズームボタン／Fit View／ノードクリックで**視点を保ったまま**チャット・パンくず・経路が更新／テーマ切替でフィットし直す／**枝作成で視点が完全保持**（transform 一致）／全画面でもパン・クリックが動く／マップ開閉で潰れない／コンソールエラーなし。`artisan test` 61件緑、`npm run build` 通過。
- **次にやること:** 「7. 仕上げ」。N+1チェック（eager load）、バリデーション/エラーハンドリングの見直し、発展課題（AIが話題転換を検知して枝を提案）。

### 2026-07-28 セーブポイント（Step7-1 センタリング＋N+1 完了）
- **技術選定（本人）**: ①センタリングは**画面外のときだけ**寄せる（vs 常に中央へ）②N+1 修正は**クエリ本数を assert するテストで固定**する（vs 修正だけ）③`NodePolicy` の定数+1クエリは**触らず記録**（vs 消す）④課金される `/chat` の throttle・`content` の `max:`・401 の扱いは**7-2 へ**。根拠は `api/README.md` 設計判断ログ。
- **このスライスの肝**: **6-4 で pan/zoom を足したことが新しい穴を開けた**。動かせるようになったぶん「現在地を見失える」ようになり、パンくずから戻っても選択ノードが画面外のままになる＝Phase1 のコアバリューに直接反する。機能追加が別の要件を生む例。
- **N+1 調査の結論**: 全経路を見た結果、**本物の N+1 は `ContextBuilder` の1件だけ**（`ProjectController@index`・`NodeController@index` は Step4 で `withCount` 済み）。**実測で深さ3=4本／深さ8=9本 → どちらも2本**に。`whereIn`＋PHP側で切る案は「根で長く会話して早く分岐した木」で捨てる行を大量転送するため却下し、`orWhere` グループで1クエリのまま過不足なく取る形にした。
- **見つけて直したバグ2件**: ①**マウント時に `fitView` と競合**し、テーマ切替のたびに俯瞰が消えて根が等倍で中央に来た（タイミング次第で出たり出なかったり）→ **初回の選択は `fitView` の担当**としてスキップ。②**タブが裏だと `setCenter` のアニメーションが永久に完了しない**（d3 トランジション＝rAF 駆動）→ `document.visibilityState` を見て非表示なら `duration: 0`。
- **嵌まりどころ ⚠️**: 検証用の Browser ペインが `hidden` で **rAF が 800ms で0回**しか回らず、「`duration: 0` なら効くのに `duration: 300` だと効かない」の原因切り分けに時間がかかった。`document.visibilityState` と rAF のカウントを測って確定。
- **テスト設計**: assert を絶対値でなく**「深い経路と浅い経路が同じ本数」**にした（「深さに比例しない」の定義そのもの／定数クエリが増えても壊れない）。`DB::listen` のリスナは外せないので、リスナは1つだけ登録しカウンタを間でリセットする。
- **検証**: `artisan test` **62件緑**、`pint` 通過、`npm run build` 通過。ブラウザ実機（**課金ゼロ・実送信なし**）で、選択ノードがペイン中心に一致（オフセット `[0,0]`）・倍率不変／見えているノードでは transform 完全不変／枝作成で新ノードが画面内に入る／テーマ切替で `fitView` と競合しない／全画面でも同じ／`/context` が分岐点までの8件を正しく返す／コンソールエラーなし。
- **次にやること:** 7-2（`content` の `max:`／`/chat` の throttle／401 のフロント処理）。

### 2026-07-28 セーブポイント（Step7-2 バリデーション・エラーハンドリング 完了）
- **技術選定（本人）**: ①`content` は **10,000文字** ②チャットは **1分1回＋1日50回** ③401 は **`client.ts` で捕まえ、一言出してから `/login`**。根拠は `api/README.md` 設計判断ログ。
- **このスライスの肝**: **`TEXT` の上限はバイトであって文字ではない**（65,535バイト＝日本語で約21,800文字）。そして **FormRequest で守れるのはユーザー入力だけ**で、`NodeChatController` が保存する **AI の返答はバリデーションを通らない**。`ANTHROPIC_MAX_TOKENS` を上げれば同じ経路で 500 になり得るため、コードで切り詰めず `.env.example` に境界として明記した。
- **⚠️ テストが弱かったので書き直した**: 最初の日次上限テストは3回連続送信するだけで、**時間が進まないため日次カウンタが分単位の窓の失効を跨ぐかを検証できていなかった**。`travel(61)->seconds()` で分をまたぐ形にし、**`Limit::perDay` を外すと落ちる**ことを確認してから採用。7-1 と同じく「テストを実際に壊して何を守っているか確かめる」手順。
- **見つけて直したもの2件**: ①**CORS が `Retry-After` を隠していた** → `exposed_headers` に追加して「59 秒おいてから」と出せるように（6-1 で Vite proxy を使わず本物のクロスオリジンを通す構成にしたから表に出た）②バリデーションエラーが英語のままチャット欄に出ていた → `messages()` で日本語化。
- **踏んだ罠**: 起動時の `/me` は未ログインでも 401 を返すので、素直に 401 ハンドラを書くと**初回訪問者に「セッションの有効期限が切れました」と表示される**。`status` を ref で持ち「authenticated だと思っていた場合だけ」反応させて解決。
- **分かったこと（記録）**: throttle はミドルウェアなので FormRequest より先に走り、**422 でもレート制限のカウントは進む**。AI は呼ばれないので課金はゼロ。この性質を使い、**422 でカウントを進めてから2通目を送ることで、AI を一度も呼ばずに 429 を再現**して検証した。
- **⚠️ 検証中の事故**: 429 の確認中、直前の試行から1分以上経って分単位の窓がリセットされ、**意図せず AI に1回実送信した**（短い1往復分の課金）。`TypeScript の型` ノードに発話 id 23・24 が残っている。以後は上記の課金ゼロの方法に切り替えた。
- **検証**: `artisan test` **68件緑**、`pint` 通過、`npm run build` 通過。ブラウザ実機で 422／429／保存されないこと／セッション切れ→`/login`＋理由表示／初回訪問では出ない／ログインし直して復帰／コンソールエラーなし。
- **次にやること:** 発展課題（C案: AIが話題転換を検知して枝を提案）、または残りの仕上げ。

### 2026-07-28 セーブポイント（Step7-3 AI 回答の Markdown 描画 完了）
- **技術選定（本人）**: ①**`react-markdown` + `remark-gfm`**（vs 自作パーサ / `marked`+`DOMPurify`）②**AI 回答は吹き出しを外して全幅**、ユーザー発話は吹き出しのまま ③ハイライトは **`rehype-highlight`**（重さを実測してから採用）④生 HTML は**無効のまま**。根拠は `api/README.md` 設計判断ログ。
- **このスライスの肝**: 「Markdown が記号のまま出る」より先に、**`.bubble` に `white-space` が無く改行そのものが潰れていた**。長い回答が一続きの塊になり、**「回答を読んで、逸れたと感じたら枝を作る」という中核体験が成立していなかった**。見た目の改善ではなく Phase1 の価値の修復として扱った。
- **選定の決め手（安全側の設計）**: `marked`+`DOMPurify` は HTML 文字列を `dangerouslySetInnerHTML` で挿すので**サニタイズの責任を自分で負う**。`react-markdown` は `rehype-raw` を入れない限り生 HTML を DOM にしないので、**何もしないことが安全側**になる。AI の出力をそのまま描画する画面なので、この差を優先した。
- **⚠️ 依存追加の責任（実測）**: gzip で 137KB → 186KB（react-markdown）→ **240KB**（＋ハイライト）。**シンタックスハイライトの方が Markdown 本体より高い**（+54KB vs +49KB／`lowlight` の約37言語分）。しかも **`rehype-highlight` の `languages` オプションでは削れない**——`import {common} from 'lowlight'` が静的 import なので、減らすならプラグインを捨てて `createLowlight()` で自作するしかない。**測ってから「割に合わない」と判断して見送り、事実として記録**。パッケージは 98 → **201**、`npm audit` は導入前と同じ 2 high で新規ゼロ。
- **見つけて直したもの2件（どちらも CSS の落とし穴）**: ①**`overflow-x: auto` だけではコードブロックは自分の中でスクロールしない**。flex/grid の自動最小サイズが content の min-content になるため、長いコード行が外側を押し広げてページごと横に伸びた（幅820pxで `documentElement.scrollWidth` が 1402）。`min-width: 0` を **grid の中央カラム／`.msg`／`.markdown`** の3箇所に入れて解決（既にあった `min-height: 0` の**横版**）。②**highlight.js の配布テーマが `.hljs` 自身をスクロールコンテナにしていた**ため `code` と `pre` で二重になり、「`pre.scrollWidth === clientWidth` なのに横に切れている」という矛盾した観測になった。`pre code` 側で戻して **枠と背景は自前・トークンの色だけテーマに任せる**形に統一。
- **嵌まりどころ ⚠️**: 枝ボタンを全幅に伸ばさないため `.msg.assistant` に `align-items: flex-start` を入れたら、**本文も shrink-to-fit になって表の min-content 幅（769px）に膨らんだ**。`fit-content = max(min-content, available)` なので `min-width: 0` だけでは効かず、本文だけ `align-self: stretch` で明示的に伸ばす必要があった。
- **実装**: `components/Markdown.tsx`（新規・プラグインは**モジュール定数**／表は横スクロール箱で包む／`a` に `target="_blank" rel="noreferrer"`）、`ChatPanel` は role で分岐（**ユーザー発話は Markdown にしない**——自分が打った `*` は文字として出したい）、`styles.css` に `.markdown` タイポグラフィ、`main.tsx` でテーマ CSS、`AnthropicClient::SYSTEM_PROMPT` に1行。
- **プロンプトの1行**: 「**内容量に見合う範囲で**」「短い答えを無理に飾る必要はありません」を明記。これが無いと一行で済む質問にも見出しが付く。なお `NodeChatTest` は `AnthropicClient` をモックしているので、**この1行はテストに守られていない**（記録に留める）。
- **検証（課金ゼロ・実送信なし）**: `artisan test` **68件緑**、`pint` 通過、`npm run build` 通過。`tinker` で表・コード・引用・ネストリスト・長い識別子を含む発話を dev DB に1件入れて実機確認（**確認後に削除済み**）。見出し・太字・リスト・表・引用が体裁として出る／PHP がトークン単位で色付く／**3行の発話が3行のまま**（`pre-wrap`・高さ87px）／**枝ボタンは133px で全幅に伸びない**／幅820pxまで縮めても**ページも `.messages` も横にはみ出さず**（overflow 0）`pre` が自分の中でスクロール（`scrollWidth` 753 vs `clientWidth` 185）／枝作成→ツリー更新→パンくず3階層→新ノードへ移動が従来どおり／`Invalid hook call` を含むコンソールエラーなし。
- **6-4 の教訓を再現させなかった**: dev サーバを止めてから `npm install` し、`node_modules/.vite` を消して起動（起動中に足すと React が二重読み込みになる）。
- **残した既知の癖**: GFM の autolink は URL 直後に空白なしで全角文字が続くと**その全角文字までリンクに含める**。remark-gfm の仕様の範囲で、実際の AI 出力ではまず起きないため触っていない。
- **次にやること:** 発展課題（C案: AIが話題転換を検知して枝を提案）、または残りの仕上げ。
