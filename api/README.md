# 思考の樹形図 API（Laravel バックエンド）

> 全体設計は親ディレクトリの [PLAN.md](../PLAN.md) が正本。実装TODOは [CHECKLIST.md](../CHECKLIST.md)。
> 以下は「技術選定 → 実装 → レビューして記録」の**設計判断ログ**（＝面接台本）。

## 実行前提

- **PHP 8.4 必須**。`php` は 8.2 に解決され Composer が拒否するため、artisan は必ず `/opt/homebrew/opt/php@8.4/bin/php artisan ...` で実行する。
- 開発DBは MySQL `nest`。テストは SQLite `:memory:`（`phpunit.xml`）＋ `SESSION_DRIVER=array` なので開発DBは汚れない。

## 設計判断ログ

### Step5: AI連携（Anthropic 公式PHP SDK / 同期）

**採用**: 公式PHP SDK `anthropic-ai/sdk` を導入し、`App\Services\AnthropicClient` でラップ。`POST /api/nodes/{node}/chat` で同期的に呼ぶ。

- **なぜ公式SDK か（vs Http ファサード）**: 型が付き、将来ストリーミングやツール使用へ拡張する際に有利で、API 変更への追従を SDK に任せられる。
  - **トレードオフ（正直な記録）**: 依存が増える＝脆弱性監視とバージョン制約の対象が増える。実際このプロジェクトは `composer audit` の advisory（guzzle 系9件・SDK導入前から存在）と「`php` が 8.2 に解決されて Composer が拒否する」制約問題を経験している。**今回の用途（`/v1/messages` に1回POSTしてテキストを取り出すだけ）に限れば Http ファサードでも十分**で、`Http::fake()` の方がテストは素直だった。拡張余地を優先して SDK を選んだ、という判断。
  - なお `api/CLAUDE.md` の「依存を勝手に変えない」は Laravel Boost が自動生成した規約であり、承認者は開発者本人。今回は明示的に承認して導入した。
- **`AnthropicClient` で境界を切った理由**: プロバイダ固有の知識（SDKのクラス、`stopReason`、ブロック構造）をこの1クラスに閉じ込めた。コントローラは `$ai->chat($context): string` としか知らないので、**Http実装や別プロバイダへの乗り換えは実質1ファイル＋そのテストで済む**。Phase6 の「必要ならクロージャテーブルへ移行可能」と同じ、可逆性を残す設計。
- **なぜ同期か（vs キュー / ストリーミング）**: キューは 202 を即返せる代わりに `queue:work` の常時起動とフロントのポーリングが要る。ストリーミング（SSE）は UX は最高だがバック・フロント双方が複雑になる。今回は「1往復して結果を返す」だけなので同期が最小で、スライスをレビュー可能な大きさに保てる。**遅延（10〜30秒）を受け入れる代わりに運用と実装をゼロコストにした**判断。
- **AI 失敗時にユーザー発話を残す**: トランザクションで巻き戻さない。理由＝コアバリューは「学習履歴が残り、来た道に戻れる」こと。エラーで質問が消えると再入力が必要になり価値と矛盾する。ユーザーは同じノードで再送すれば続きから再開できる。テストで実証（502 が返っても user の message は DB に残る）。
- **エラー設計**: SDK の `Anthropic\Core\Exceptions\APIException`（および想定外の `Throwable`）を `App\Exceptions\AiRequestException` に包み直し、`render()` で **502 Bad Gateway**（＝上流の失敗であり、このAPIのバグではない）。**APIキーやプロバイダの生ペイロードを例外メッセージ・ログに含めない**。`stopReason === 'refusal'`（AIが回答を拒否）と空応答も同じ例外にまとめ、コントローラは分岐不要にした。
- **APIキーの扱い**: `config/services.php` 経由で `.env` から読み、`AppServiceProvider` で `Anthropic\Client` をシングルトン登録。**サーバ側のみでフロントには出さない**（PLAN 非機能要件）。モデルIDも `ANTHROPIC_MODEL` で差し替え可能。
- **テストで SDK ではなくラッパをモックした理由**: `$this->mock(AnthropicClient::class)` で自作の境界を差し替える。SDK の内部HTTPをモックするとSDKの実装詳細に依存して壊れやすいが、`chat(Collection): string` という自分で決めた契約なら安定する。**実APIを呼ばない＝テストは常に課金ゼロ**。
- **文脈の受け渡し**: ユーザー発話を**保存してから** `ContextBuilder::build()` を呼ぶ（今の発話も文脈に含めるため）。テストでは A→B の分岐で「分岐点までの祖先 messages ＋ 自ノードの発話」だけが AI に渡り、分岐後の発話が混入しないことを検証している。

**検証**: `/opt/homebrew/opt/php@8.4/bin/php artisan test`（全57件緑。AI呼び出しは全てモックのため課金なし）。

### Step4→5 橋渡し: 祖先パス（再帰CTE）＋ ContextBuilder

**採用**: `Node::ancestorPath()`（再帰CTE）＋ `App\Services\ContextBuilder`。エンドポイントは `GET /api/nodes/{node}/path`・`/context`。

- **なぜパス（祖先チェーン）が要るか**: 枝の奥のノードで質問したとき、AI には「そこに至る会話」が必要。だが履歴は1ノードに収まらない（子ノードには分岐**後**の発話しか無い）。よって `parent_id` を根までたどり、各祖先の「子が分岐した発話まで」の messages を拾い集めて文脈を復元する。パスは ①AIに送る文脈の復元（主目的）②現在地パンくずナビ の土台。復元できる理由: messages は `node_id` で永続保存され消えず、各ノードは「親のどこで分かれたか（`branch_from_message_id`）」だけ覚えているため、鎖をたどれば必要部分だけ組み直せる。
- **なぜ再帰CTE か（vs 全ノード取得してメモリ）**: `WITH RECURSIVE` の生SQL（`DB::select`）は**1クエリで祖先チェーンだけ**を的確に返す（対象→親→…と自動でたどる）。アプリ側で全ノードを取ってPHPで組む案は生SQL不要・DB非依存だが、必要な祖先より多く読む。今回は「再帰CTEを書ける」ことを示す狙いと的確さを優先。**標準構文なので MySQL8 と SQLite（テストDB）両方で動く**ことを feature test で実証済み。`depth` を持たせ `ORDER BY depth DESC` で根を先頭に整列。
- **ContextBuilder のアルゴリズム**: `ancestorPath()`（根→対象）を得て、各ノード `n` の messages を「パス上の**次のノード（子）** の `branch_from_message_id` まで」（`where('id','<=',$childBranchId)`）採用し連結。**対象ノードは全 messages**。`id` はノード内で単調増加＝発話順なので「その発話まで」を id 比較で表現できる。分岐**後**の発話（例の a3・b3）は含まれない。
  - **null 分岐点の扱い**: 子の `branch_from_message_id` が null（分岐点未設定）ならカットオフ不明として親スレッド全体を採用（best-effort）。通常フローでは分岐時に必ず設定される。
- **`app/Services/` の導入**: AI 文脈組み立てはモデル/コントローラの責務ではないため専用サービスに分離（Step5 の AI 呼び出しでも再利用）。コントローラは DI で受け取り薄いまま。
- **認可**: 両エンドポイントとも `NodePolicy@view`（他人のノードは 403、未認証 401）。

**検証**: `/opt/homebrew/opt/php@8.4/bin/php artisan test`（全51件緑。A→B→D で `context` が `[a1,a2,b1,b2,d1,d2]`＝各ノード分岐点まで＋対象は全部、を検証。再帰CTE が SQLite で通ることも込み）。

### Step4（スライス2）: nodes + messages CRUD ＋ 認可

**採用**: shallow nest ルート、**葉ノードのみ削除可**、nodes と messages を同スライスで実装。アプリの核心＝分岐（`branch_from_message_id`）を通す。

- **shallow nest（浅いネスト）**: 作成/一覧は親配下（`POST/GET /api/projects/{project}/nodes`、`/api/nodes/{node}/messages`）、単体 show/update/destroy はフラット（`/api/nodes/{node}`）。理由: 作成・一覧は「どの親か」が本質的に要るので親を URL に置くと自然で、**親の所有権を先に検証すれば子まで守れる**（`ProjectPolicy@update` を通ってから node を作る）。単体操作は node id だけで一意なので親を繰り返さない。`Route::apiResource(...)->shallow()` で表現。
- **認可を親から導出**: `NodePolicy` の所有権は **node → project → user**（`$node->project->user_id === $user->id`）。nodes index/store は親 `Project` を `ProjectPolicy` で、messages index/store は親 `Node` を `NodePolicy` で認可（発話追加＝ノードのスレッド変更 → `update`）。MessagePolicy は作らず NodePolicy に集約し、認可の階層を「上位リソースの所有＝下位の操作可否」で一貫させた。
- **葉ノードのみ削除（中抜き禁止）**: `destroy` は `NodePolicy@delete` の後に `children()->exists()` を確認し、子があれば **409 Conflict** で拒否。理由: 木の途中ノードを単体削除すると子の再接続（中抜き）や枝ごと消失が起き、コアバリュー「学習履歴が残り来た道に戻れる」と矛盾する。葉だけ消せるようにして、履歴を一括で失わない安全な剪定にした。`parent_id` の FK は cascade だが、**あえて cascade に頼らず**アプリ層で子の有無を検証している（DBの挙動＝仕様ではなく、意図した制約を明示）。→ これで PLAN の「削除は project 単位が唯一」と CHECKLIST の node destroy の矛盾を「**project 単位削除＋葉ノード個別削除**」に整合。
- **分岐点のクロスフィールド検証**（`StoreNodeRequest`）: `parent_id` は `Rule::exists('nodes','id')->where('project_id', ルートの project)` で**同一 project 内のノード**に限定。`branch_from_message_id` は `Rule::exists('messages','id')->where('node_id', 入力の parent_id)` で**親ノードのスレッド内の発話**に限定（親が無ければ where が何にも一致せず、根ノードに分岐点を付けられない）。位置ではなく発話の同一性で分岐点を持つ設計を、検証レベルでも守る。`project_id` はリクエストから受けずルートの project から設定（マスアサインメント対策）。
- **message role のアプリ層 enum 検証**: DB は `role` を string にしており（ENUM 制約なし）、`StoreMessageRequest` の `in:user,assistant` で担保。将来 role を増やす柔軟性と、入口での妥当性検証を両立。
- **Resource**: `NodeResource` は `whenCounted('children')`（フロントが葉判定に使える）/`whenCounted('messages')` を含め、index では `withCount(['children','messages'])`、show では `loadCount(...)` で N+1 を回避。

**検証**: `/opt/homebrew/opt/php@8.4/bin/php artisan test`（全45件緑 = 認証8＋リレーション7＋projects10＋nodes13＋messages7。所有権403・分岐点422・**葉のみ削除/子持ち409**・未認証401 を網羅）。

### Step4（スライス1）: projects CRUD REST API ＋ Policy 認可

**採用**: `apiResource` の projects CRUD ＋ **Policy クラスによる認可（他人のリソースは 403）**。範囲は projects のみ（nodes/messages は後続スライス）。

- **認証 vs 認可**: Step3 の認証は「**誰か**」の確認。今回の認可は「**その人がこの操作をしてよいか**」の確認で別物。素朴に `Project::findOrFail($id)` すると他人の学習ツリーを返してしまう（情報漏洩）ため、「自分の project だけ触れる」保証が要る。
- **なぜ Policy 方式（403）か**: 認可ルールを `ProjectPolicy` の1箇所に集約でき、Laravel の認可機能を明示的に使えることを示せる（面接で「認証と認可の分離」を語れる）。`view/update/delete` は `$user->id === $project->user_id` を判定し、他人のものは **403 Forbidden**。
- **トレードオフ（403 vs 404）**: 403 は「**存在はするが権限がない**」と教えてしまう（存在の漏洩）。代替は ①クエリスコープで最初から自分の分だけ引き他人のは **404**（存在を隠す）、②両者の併用。機密性が高いほど 404 隠蔽が有利だが、今回は認可機能の明示とドキュメント既定方針を優先して Policy/403 を採用した。
- **一覧（index）だけはスコープする理由**: Policy は「単体リソースの可否」を返すもので、**集合は 403 で絞れない**。よって index は `$request->user()->projects()` と所有者スコープで取得する（`viewAny` はエンドポイント自体の可否だけを見る bool）。N+1 を避けるため `withCount('nodes')` で件数を1クエリに畳み、`ProjectResource` は `whenCounted('nodes')` で読み込み時のみ `nodes_count` を出す。
- **`apiResource` が create/edit を生やさない理由**: それらは HTML フォーム表示用アクション。JSON API には不要なので index/store/show/update/destroy の5本だけが生える。
- **削除＝プロジェクト単位が唯一の削除経路**: `destroy` で project を消すと、配下 nodes/messages は **DB の FK cascade** で消える（学習履歴を枝ごと失わない設計と整合）。テストで cascade を実証。
- **Laravel 11+ の認可の書き方**: ベース `Controller` が空で `authorizeResource`（コンストラクタ middleware）が効かないため、`AuthorizesRequests` トレイトを足して各アクションで `$this->authorize()` を明示呼び出しする（認可呼び出しがコード上で見える利点もある）。
- **入力/出力**: 入力は FormRequest（`Store/UpdateProjectRequest`。`user_id` はリクエストから受けず認証ユーザーで設定＝マスアサインメント対策）、出力は `ProjectResource`。

**検証**: `/opt/homebrew/opt/php@8.4/bin/php artisan test`（全25件緑 = 認証8 ＋ リレーション7 ＋ projects 10。所有権 403・cascade 削除・未認証 401 を網羅）。

### Step3: 認証 — Laravel Sanctum / SPA cookie セッション方式

**採用**: SPA cookie（ステートフル）方式。Bearer トークン方式ではない。

- **なぜ cookie 方式か（vs Bearer トークン）**: フロント（Vite React SPA）とバック（Laravel）を**同一サイト扱い**にする構成に最も自然。認証状態は **HttpOnly Cookie のセッション**で持つため、トークンを JS（localStorage 等）に置かずに済み **XSS でトークンを盗まれない**。トレードオフ: 別オリジン／モバイルには弱い（その場合は Bearer 方式が有利）。本プロダクトは Web SPA 単一クライアント前提なので cookie 方式の利点が勝つ。
- **stateful ドメインの役割**: Sanctum の `EnsureFrontendRequestsAreStateful`（`bootstrap/app.php` の `$middleware->statefulApi()`）が、リクエストの `Origin`/`Referer` を `SANCTUM_STATEFUL_DOMAINS` と照合し、一致した「自分のフロント」からのアクセスにだけ **セッション＋CSRF ミドルウェアを差し込む**。これで API が cookie セッションで認証できる。
- **CSRF / SameSite の役割**: cookie 認証は CSRF の的になるため、フロントは書き込み前に `GET /sanctum/csrf-cookie` を叩いて `XSRF-TOKEN` を受け取り、以降ヘッダで送り返す。cookie の SameSite と合わせて別サイトからの偽装リクエストを弾く。
- **`supports_credentials => true`（`config/cors.php`）が要る理由**: ブラウザは既定で cross-origin に cookie を乗せない。credentials を許可して初めて SPA→API に cookie が届く。かつ **credentials 有効時は `Access-Control-Allow-Origin` に `*` を使えない**ため、`allowed_origins` はフロントのオリジンを明示（`FRONTEND_URL` 環境変数）。
- **`session()->regenerate()`（login/register）と `invalidate()`（logout）の意図**: ログイン等の権限変化時にセッションIDを振り直して**セッション固定攻撃**を防ぐ。logout ではセッション破棄＋CSRFトークン再生成で後始末する。
- **`auth:sanctum` ガード**: `config/sanctum.php` の `guard => ['web']` により、sanctum ガードは cookie セッション（web ガード）を見て認証する。保護ルート（`/me`,`/logout`）は未認証なら `api/*` の JSON 例外描画で **401 を返す**（`bootstrap/app.php` の `shouldRenderJsonWhen`）。

**構成（薄いコントローラ）**: バリデーションは FormRequest（`RegisterRequest`／`LoginRequest`。`LoginRequest::authenticate()` に `Auth::attempt`＋レート制限を集約）、出力は API Resource（`UserResource`、`password` 等は出さない）。エンドポイントは `register / login`（ゲスト）と `me / logout`（`auth:sanctum`）の4本。

**詰まった点 / テストの罠**:
- **「Session store not set on request」**: `statefulApi()` は stateful ドメインからのリクエストにしかセッションを差し込まない。テストで `Origin` ヘッダが無いと `session()->regenerate()` が 500 になる。→ `beforeEach` で `config(['sanctum.stateful' => ['localhost']])` ＋ `Origin: http://localhost` を付け、本番の SPA リクエストを再現して解消。
- **logout の検証**: `actingAs()` はテスト内でユーザーをガードに固定するため、logout 後の別リクエストや `assertGuest()` が素直に効かない。よって logout テストは **204 の契約**を検証し、「未認証は保護ルートを叩けない（401）」は別テストで担保する分担にした。

**検証**: `/opt/homebrew/opt/php@8.4/bin/php artisan test`（全15件緑 = 既存リレーション7 ＋ 認証8）。

---

<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
