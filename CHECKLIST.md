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
- [ ] モノレポ構成を作る: `frontend/`（Vite React, prototype を昇格） / `api/`（Laravel） ※`api/` のみ完了、`frontend/` 昇格は未

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
- [ ] シーダーでダミーデータ（A→B/C 分岐を1本作り分岐点の動作を確認できる形に）

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

**6-2 メイン画面を実データに接続**（次）
- [ ] メイン画面(案6)：左テーマ / 中央チャット / 右マインドマップ、開閉・全画面 ※UIは昇格済み、**実APIへの接続が未**
- [ ] projects/nodes/messages 取得、ノード/テーマ切替、パンくず（`GET /nodes/{id}/path`）
- [ ] 案1〜5（`layouts.tsx` の Layout1〜5・`trees/` の未採用3種）を整理

**6-3 チャットと枝作成**
- [ ] チャット送信→`POST /nodes/{node}/chat`→AI回答表示
- [ ] 「ここから枝を作る」→ nodes API で子ノード生成→ツリー更新
- [ ] ⚠️ `branchFromIndex`（位置）→ **`branch_from_message_id`（メッセージID）** へ修正（Step1 の判断に合わせる）

**6-4 マインドマップ強化**
- [ ] マインドマップを @xyflow/react で pan/zoom 対応に置換

## 7. 仕上げ（非機能・任意）

- [ ] バリデーション（FormRequest）／エラーハンドリング
- [ ] N+1チェック（eager load `with`）
- [ ] README に設計判断（隣接リスト採用理由・ハイブリッド分岐など）を記述＝ポートフォリオ用
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
