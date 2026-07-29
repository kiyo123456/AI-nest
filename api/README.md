# 思考の樹形図 API（Laravel バックエンド）

> 全体設計は親ディレクトリの [PLAN.md](../PLAN.md) が正本。実装TODOは [CHECKLIST.md](../CHECKLIST.md)。
> 以下は「技術選定 → 実装 → レビューして記録」の**設計判断ログ**（＝面接台本）。

## 実行前提

- **PHP 8.4 必須**。`php` は 8.2 に解決され Composer が拒否するため、artisan は必ず `/opt/homebrew/opt/php@8.4/bin/php artisan ...` で実行する。
- 開発DBは MySQL `nest`。テストは SQLite `:memory:`（`phpunit.xml`）＋ `SESSION_DRIVER=array` なので開発DBは汚れない。

## 設計判断ログ

### Step7 スライス3: AI 回答の Markdown 描画（吹き出しをやめて「読み物」にする）

**採用**: `react-markdown` + `remark-gfm` + `rehype-highlight`。**AI 回答は吹き出しを外して全幅**、ユーザー発話は吹き出しのまま。生 HTML は無効のまま維持。

#### ① 発覚した状態 — 「Markdown が読めない」だけではなかった

`ChatPanel` は `{message.content}` を素のテキストとして吹き出しに入れていた。Claude は Markdown で返すので `##` や `**` が記号のまま出ていたが、それ以上に問題だったのは **`.bubble` に `white-space` 指定が無く改行そのものが潰れていた**こと。長い回答が一続きの塊になり、**「AI の回答を読んで、逸れたと感じたら枝を作る」という中核体験が成立していなかった**。Phase1 の価値に直接効く欠陥だったので、見た目の改善ではなく機能の修復として扱った。

#### ② ライブラリ選定 — 自作パーサを捨てた理由

- **`react-markdown`（9系）を採用**。見出し・太字・リスト程度なら自作でも書けるが、**表・ネスト・コードブロックで必ず破綻する**。学習アプリの回答に表とコードは日常的に出るので、ここは車輪の再発明にしかならない。
- **`marked` + `DOMPurify` は却下**。HTML 文字列を作って `dangerouslySetInnerHTML` で挿す構成は、**サニタイズを正しく通す責任を自分で負う**ことになる。`react-markdown` は既定で生 HTML を無視する（`rehype-raw` を入れない限り DOM にならない）ので、**何もしないことが安全側**になる。これが決め手。
- **`remark-gfm` は必須**。無しだと GFM の表がただの段落として落ちる。
- **描画のカスタムは2点だけ**（`components`）。表を `.md-table-scroll` で包む（狭い中央カラムでのはみ出し対策）、`a` に `target="_blank" rel="noreferrer"`（**AI 出力に混ざる外部リンク**なので参照元を渡さない）。プラグイン配列は**モジュール定数**にしてある——render ごとに新しい配列を渡すとプラグイン鎖が作り直される。

#### ③ 依存追加の責任 — ハイライトは Markdown 本体より重い

実測（`npm run build`、gzip）:

| | JS | gzip | 導入前比 |
|---|---|---|---|
| 6-4 時点 | 426 KB | 137 KB | — |
| ＋ react-markdown / remark-gfm | 586 KB | 186 KB | +49 KB |
| ＋ rehype-highlight / highlight.js | **764 KB** | **240 KB** | **+103 KB** |

- **シンタックスハイライトの方が Markdown 本体より高い**（+54 KB gzip vs +49 KB）。理由は `lowlight` の `common` = 約37言語分の文法が入るため。
- **⚠️ `rehype-highlight` の `languages` オプションでは減らせない**: `lib/index.js` が `import {common} from 'lowlight'` を**トップレベルで静的に** import しているため、自前の言語セットを渡しても `common` はバンドルに残る。**本当に削るならプラグインを使わず `createLowlight()` で自作する**しかない。今回は測ってから「この規模の個人開発では割に合わない」と判断して見送り、事実として記録する。
- 直接依存は4つだが**実際は 98 → 201 パッケージ**（unified / remark / rehype / micromark 系）。`npm audit` は**導入前と同じ 2 high で新規ゼロ**。

#### ④ CSS の落とし穴 — flex の自動最小サイズで「ページが横に伸びる」

`overflow-x: auto` を付けただけではコードブロックは自分の中でスクロールしない。**flex item / grid track の自動最小サイズが content の min-content になる**ため、長いコード行がその外側を押し広げる。実測で犯人を切り分けた（`.markdown pre` を `display:none` にすると `documentElement.scrollWidth` が 1402 → 855）。3箇所の `min-width: 0` が必要だった:

- **`.layout6 .center6`** — grid の `1fr` は `minmax(auto, 1fr)`。既にあった `min-height: 0`（縦スクロールのため）と**同じ理屈の横版**。これを入れるとページの横スクロール自体が消える（幅820pxで 1402 → 820）。
- **`.msg`** — flex item なので、中の表やコードブロックの min-content まで広がる。
- **`.markdown` ＋ `align-self: stretch`** — 枝ボタンを全幅に伸ばさないため `.msg.assistant` に `align-items: flex-start` を入れており、その結果**本文も shrink-to-fit になって `fit-content = max(min-content, ...)` で 769px に膨らんでいた**。本文だけ明示的に stretch させる。

#### ⑤ highlight.js のテーマが二重のスクロールコンテナを作っていた

配布テーマ（`atom-one-dark.css`）は `.hljs` 自身に `display: block; overflow-x: auto; padding; background` を載せてくる。つまり**`code` 要素がスクロールコンテナになり、自前の `pre` の枠と二重になる**（`pre.scrollWidth === clientWidth` なのに横に切れている、という一見矛盾した観測になった）。`.markdown pre code` で `background` / `padding` / `overflow-x` を戻し、**枠と背景は自前・トークンの色だけテーマに任せる**形に統一した。**言語指定のないコードブロックには `.hljs` が付かない**ので、揃えないと同じ画面で挙動が変わってしまう。

#### ⑥ 描画するのはフロントだが、プロンプトも1行だけ足した

`SYSTEM_PROMPT` に「Markdown で構造化してください」を追加。**「内容量に見合う範囲で」「短い答えを無理に飾る必要はありません」を明記**したのが要点で、これが無いと一行で済む質問にも見出しが付く。`NodeChatTest` は `AnthropicClient` をモックしているので、プロンプト変更で落ちるテストは無い（＝**この1行はテストに守られていない**ことも記録に留める）。

#### ⑦ ユーザー発話は Markdown にしない

自分が打った `*` は文字として出したい。改行だけ `white-space: pre-wrap` で残す。「考え中…」の吹き出しも assistant 側だが**文書ではなく一時的な状態表示**なので吹き出しのまま残し、本文と見分けが付くようにした。

**検証（課金ゼロ・AI への実送信なし）**: `artisan test` **68件緑**、`pint` 通過、`npm run build` 通過。`tinker` で表・コード・引用・ネストリスト・長い識別子を含む発話を dev DB に1件入れて実機確認（確認後に削除済み）。①見出し・太字・リスト・表・引用・コードが体裁として出る／PHP がトークン単位で色付く ②AI 回答が全幅・ユーザー発話が右吹き出しで**3行が3行のまま**表示（`pre-wrap`、高さ87px）③**枝ボタンが全幅に伸びていない**（133px）④幅820pxまで縮めても**ページも `.messages` も横にはみ出さず**（overflow 0）、`pre` が自分の中でスクロールする（`scrollWidth` 753 vs `clientWidth` 185、`scrollLeft` が動く）／表も `.md-table-scroll` 内でスクロール ⑤枝作成→ツリー更新→パンくず3階層→新ノードへ移動が従来どおり ⑥`Invalid hook call` を含むコンソールエラーなし。

**⚠️ 依存追加時の手順**（6-4 の教訓の再現防止）: dev サーバを止めてから `npm install` し、`node_modules/.vite` を消して起動した。起動中に足すと Vite の依存最適化が走り直して React が二重読み込みになる。

**残した既知の癖**: GFM の autolink は、URL の直後に空白なしで全角文字が続くと**その全角文字までリンクに含める**（検証データで `...testing-wrap）でもペインは壊れません。` が href に入った）。remark-gfm の仕様の範囲で、実際の AI 出力ではまず起きないため触っていない。

### Step7 スライス2: バリデーションとエラーハンドリングの穴を塞ぐ

**採用**: `content` を 10,000文字に制限、チャットに**1分1回＋1日50回**のレート制限、401 を `client.ts` で捕まえて理由を出してから `/login`。

#### ① `content` の上限 — バリデーションで守れる範囲と守れない範囲

- **`TEXT` の上限はバイトであって文字ではない**: `messages.content` は `$table->text()` ＝ 65,535 **バイト**。日本語 UTF-8 は1文字3バイトなので**実質 約21,800文字**。上限が無いまま超えると MySQL がエラーを返し、**422 ではなく 500** になる（＝クライアントには「何が悪いのか」が伝わらない）。10,000文字なら約30,000バイトで、カラム上限の半分以下に収まる。
- **⚠️ AI の返答はバリデーションを通らない**: `NodeChatController` は AI の応答をそのまま `create()` する。`ANTHROPIC_MAX_TOKENS=4096` なら日本語でも約12,000バイトで収まるが、**この値を上げれば同じ経路で 500 になり得る**。切り詰めると AI の回答を黙って失うので**コードは足さず、`.env.example` に境界として明記した**。「FormRequest で守れるのはユーザー入力だけで、外部から来る値は別の手当てが要る」という線引きをそのまま残している。
- **エラー文言は `messages()` で日本語化**: 既定の英語（"The content field must not be greater than 10000 characters."）がそのままチャット欄に出ていた。ユーザーの目に触れる2つのルール（`required` / `max`）だけを上書きしている。

#### ② レート制限 — 課金される唯一のエンドポイントを守る

- **なぜここだけか**: 他の全エンドポイントは手元の MySQL を読み書きするだけで何回叩いてもタダ。`POST /nodes/{node}/chat` だけが Anthropic に出ていき、トークン数で課金される。フロントの二重送信防止（`sendChat.isPending`）はクライアント側の防御でしかない。
- **2段にした理由**: 分単位（1回）は**連打と暴走ループを即座に止める**。日次（50回）は**実際のコスト上限**になる。分単位だけだとペースさえ守れば一日中叩けるので、総額に上限ができない。
- **`by()` はユーザー単位**（IP ではない）。同じ回線の別アカウントを巻き込まないため。
- **上限は `.env` で変更可能**（`ANTHROPIC_RATE_LIMIT_PER_MINUTE` / `_PER_DAY`）。「1分1回」は AI 応答が20秒で返ってきた場合に次の質問まで約40秒待つことになるので、窮屈なら**実装ではなく設定の問題**として変えられる形にした。`config()` はリミッタのクロージャの中で読むので毎リクエスト評価され、テストからも差し替えられる。
- **⚠️ バリデーション失敗もカウントされる**: throttle はミドルウェアなので FormRequest より先に走る。長すぎる文章を送って 422 になった場合でも1回分を消費する。AI は呼ばれないので**課金は発生しない**が、1分1回だと打ち間違い1回で1分待たされる。乱打への防御にもなるので現状は許容し、記録に留める。（この性質は検証にも使った——**422 でカウントを進めてから2通目を送れば、AI を一度も呼ばずに 429 を再現できる**。）
- **キーの分離は防御的な措置（差は実証できていない）**: throttle ミドルウェアはキャッシュキーを `md5(リミッタ名 . $limit->key)` で作るため、2つの Limit が同じ `by()` を持つと**同一カウンタを共有する**。これを避けて `minute:` / `day:` の接頭辞を付けた。ただし**共有キーと分離キーで観測可能な差を作ろうとして失敗した**——4回連打・6分間×6回のいずれでも結果は完全に同一だった。理屈上は正しい書き方なので分離を採用しているが、「バグを直した」とは言えない。

#### ③ テストが弱かったので書き直した

最初に書いた日次上限のテストは、`per_minute=10 / per_day=2` で3回連続送信するものだった。これは**時間が進まないので、日次カウンタが分単位の窓の失効を跨いで生き残るかを検証できていない**——つまり日次上限が本当に機能しているかを見ていなかった。`travel(61)->seconds()` で分をまたぐ形に書き直し、**`Limit::perDay` を外すとこのテストが落ちる**ことを実際に確認してから採用した（外すと3回目が 201 になる）。7-1 の「クエリ本数を数えるテスト」と同じで、**テストが何を守っているのかを実際に壊して確かめる**手順を踏んでいる。

#### ④ 401 を `client.ts` で捕まえる

- **なぜ1箇所に集約するか**: セッションはどのリクエスト中にも切れ得るので、画面ごとに処理を書くと必ず漏れる。全通信が `request()` を通る構造（6-1 で Sanctum の作法を集約したのと同じ理由）なので、ここに置けば網羅できる。
- **⚠️ 起動時の `/me` 401 で誤発火する罠**: 未ログインの初回訪問でも `GET /api/me` は 401 を返す。素直に反応させると**初めて来た人に「セッションの有効期限が切れました」と表示される**。`status` を ref で保持し、**「authenticated だと思っていた場合だけ」**反応するようにした。ブラウザで「初回訪問では出ない／セッション切れでは出る」の両方を確認済み。
- **ルーティングは触っていない**: ハンドラは `status` を `guest` に落とすだけで、既存の `RequireAuth` がそのまま `/login` へ送る。6-1 で作ったガードがそのまま再利用できた。
- **⚠️ CORS が `Retry-After` を隠していた**: 429 のメッセージに待ち秒数を出そうとしたが `null` になった。**クロスオリジンのレスポンスは CORS 安全リスト外のヘッダを JS に渡さない**ため。`config/cors.php` の `exposed_headers` に `Retry-After` を追加して「59 秒おいてから」と出せるようになった。6-1 で「Vite proxy を使わず本物のクロスオリジンを通す」と決めた構成だからこそ表に出た問題。
- **書きかけの下書きは失われる**（リダイレクトで `ChatPanel` が unmount される）。今回のスコープ外として記録に留める。

**検証**: `artisan test` **68件緑**（62＋新規6）、`pint` 通過、`npm run build` 通過。ブラウザ実機で、①10,001文字→**422** が日本語で表示（500 にならない）②2通目→**429** が「59 秒おいてから」と表示 ③429・422 のどちらでも**発話が保存されていない**（＝AI も呼ばれていない）④セッション切れ→`/login` へ遷移し理由が出る ⑤**未ログインの初回訪問ではそのメッセージが出ない** ⑥ログインし直して通常操作に戻る ⑦コンソールエラーなし。

**⚠️ 検証中の事故**: 429 の確認中、**直前の試行から1分以上経って分単位の窓がリセットされ、意図せず AI に1回実送信してしまった**（短い1往復分の課金）。以後は「422 でカウントを進めてから2通目を送る」方法に切り替え、AI を呼ばずに 429 を再現している。

### Step7 スライス1: 選択ノードの自動センタリング ＋ ContextBuilder の N+1 解消

**採用**: 選択ノードは**画面外のときだけ**ビューに寄せる。`ContextBuilder` の N+1 を1クエリにまとめ、**クエリ本数をテストで固定**する。`NodePolicy` の定数+1クエリは触らず記録に留める。

#### ① 自動センタリング（6-4 が生んだ課題）

- **6-4 で pan/zoom を入れた結果、新しい問題が生まれた**: マップを動かせるようになったぶん「現在地を見失える」ようになった。パンで視点をずらした状態でパンくずや枝作成からノードを選ぶと、**選択したノードが画面外のまま**になる。Phase1 のコアバリューは「来た道が残り、いつでも元の枝に戻れること」なので、**戻ったのに見えない**のは直接そこに反する。機能を足したことで別の穴が開いた例。
- **「常に中央へ」ではなく「画面外のときだけ」**: 見えているノードをクリックするたびにマップ全体が動くのは、隣のノードを続けてクリックするときに酷い。**ユーザーが自分で置いたビューのほうが、中央に揃っていることより価値がある**という判断。
- **倍率は変えない**: ユーザーが俯瞰のために意図的に引いている可能性があるので、`setCenter` に現在の `zoom` をそのまま渡す。
- **⚠️ マウント時に `fitView` と競合した（実際に踏んだ）**: 初回は `fitView` が全体を映すのが正解なのに、エフェクトが `fitView` の適用より先に走ると「ビューポートは初期値・ノードは原点付近＝画面外」と判定して**根ノードを等倍で中央に寄せてしまい、俯瞰が消えた**。テーマ切替のたびに再現し、しかもタイミング次第で出たり出なかったりした。**初回の選択は `fitView` の担当**と決め、最初の1回はスキップするようにして解消。マップはテーマ単位で remount する（6-4 の `key={selectedProjectId}`）ので、テーマ切替でも同じ経路で正しく動く。
- **⚠️ タブが裏だとアニメーションが永久に終わらない**: `setCenter` の `duration` は d3 のトランジション＝`requestAnimationFrame` 駆動で、**タブが非表示だと rAF が止まるので移動が一切起きない**。しかも「このノードは処理済み」フラグを先に立てているため、戻ってきても再試行されない。`document.visibilityState` を見て、非表示なら `duration: 0` で即座に移動するようにした。（検証環境の Browser ペインが `hidden` で rAF が **800ms で0回**しか回らず、これが原因の切り分けに時間がかかった。実ブラウザでもタブを裏に回せば同じことが起きるので、環境固有の話ではない。）

#### ② N+1 を全経路調べた結果

- **本物の N+1 は1件だけだった**。`ProjectController@index`（`withCount('nodes')`）と `NodeController@index`（`withCount(['children','messages'])`）は Step4 の時点で対策済み。
- **`ContextBuilder::build()` が唯一の N+1**: `ancestorPath()` で経路を1本引いたあと、`flatMap` の中で**ノードごとに `$node->messages()->get()` を発行**していた。**実測: 深さ3で4本、深さ8で9本**（＝1本＋深さ分）。`GET /nodes/{id}/context` と**毎回の `POST /nodes/{id}/chat`** の両方が通る。
  - **性能上いま困ってはいない**（ツリーは小さく、`/chat` は AI 応答10〜30秒が支配的）。直した理由は、**深掘り＝木が深くなることがこのプロダクトの推奨する使い方**であり、深さに比例する処理が一番育つ場所にあるから。
  - **修正後: 深さ3でも深さ8でも2本**（再帰CTE＋messages）。
- **`whereIn('node_id', ...)` で全部取って PHP 側で切る案は却下**: 実装は短いが、**根で長く会話してから早い段階で分岐した木**（このアプリでは普通に起きる形）で捨てる行を大量に転送する。各ノードの条件を `orWhere` グループで並べれば、1クエリのまま過不足なく取れる。
- **`NodePolicy::owns()` の `$node->project` は遅延ロードで毎回+1クエリ**だが、**深さにも件数にも比例しないので N+1 ではない**と判断して手を入れなかった。消せば1クエリ減るが、認可またはルート定義に仕掛けが増え、読む人に「なぜこうなっているか」が見えにくくなる。**「探して、これは違うと判断した」ことごと記録するのが誠実**という整理。

#### ③ クエリ本数をテストで固定した理由と、その書き方

- **N+1 は壊れないから気づけない**。エラーも出ず結果も正しく画面も動く。既存の `ContextBuilder` テストは**中身**（分岐点までのメッセージ）しか見ていないので、直しても直さなくても通るし、将来 `flatMap` の中でまたクエリを撃っても通ってしまう。`DB::listen()` で数えるテストだけが自動の検知手段になる。
- **assert を絶対値ではなく「深い経路と浅い経路が同じ本数」にした**: 「深さに比例しない」の定義そのものを書いているので意図が明確で、将来まっとうな理由で定数クエリが1本増えても壊れない。絶対値（2本）で縛るとそのたびに数字を直す保守コストが乗る。数字はこのログに残す。
- **`DB::listen` のリスナは外せない**ので、`countQueries()` のようなヘルパを2回呼ぶと1つ目のリスナが2回目のクエリまで数えてしまう。リスナは1つだけ登録し、カウンタを間でリセットする形にした。
- **既存の中身検証テストがそのまま通ったこと**が、書き換えでセマンティクスを壊していない証明になっている。

**検証**: `artisan test` **62件緑**（61＋新規1）、`vendor/bin/pint` 通過、`npm run build` 通過。ブラウザ実機（**課金ゼロ・AI への実送信なし**）で、①全ノードを画面外にパン→パンくずの祖先をクリック→**選択ノードがペイン中心に一致（オフセット `[0,0]`）・倍率は不変** ②見えているノードをクリック→**transform が完全に不変** ③枝作成→新ノードが画面内に入る ④テーマ切替→`fitView` が勝ち競合しない ⑤全画面でも同じ挙動 ⑥`GET /nodes/6/context` が経路 3→4→5→6 の分岐点までの8件を正しく返す（分岐後の発話が除外されている）⑦コンソールエラーなし。

### Step6 スライス4: マインドマップを @xyflow/react で pan/zoom 対応に（Step6 完了）

**採用**: `@xyflow/react` を導入して描画とビューポートを任せ、**座標計算は自前のまま残す**。操作はパン＋ズーム＋初期フィット＋ズームボタンまで。見た目は既存のピルを完全維持。

- **なぜ pan/zoom が要るのか（Phase1 との接続）**: それまでのマインドマップは「幅380pxの箱にツリー全体を実寸で描いた1枚のSVG」で、はみ出た分はブラウザのスクロールバー任せだった。シーダーの4階層ツリーですら**右端で切れて4階層目が一度も見えない**状態で、Phase1 の痛みB「**知識の全体像＝地図を持っていない**」に対する答えのはずの樹形図が、地図として機能していなかった。ドラッグで動かせ・ホイールで拡大縮小でき・開いた瞬間に全体が収まる、を満たして初めて「俯瞰できる」と言える。
- **⚠️ xyflow はレイアウトを持たない（このスライスで一番効いた理解）**: 導入前は「マインドマップのライブラリを入れれば木が描かれる」と思いがちだが、**xyflow は座標を受け取って描くだけで、どのノードをどこに置くかは決めてくれない**。だから「ライブラリ導入」と「座標計算をどうするか」は**独立した2つの選定**になる。既存の自前ロジック（深さ→x、葉に行番号を振り親は子の中央）はすでに機能していたので、`src/tree.ts` の `layoutTree()` として純粋関数に切り出して使い回した。dagre / d3-hierarchy を入れる案は却下——動いている30行を外注するために依存を増やす理由がない。結果として**「木の形は自分のコードが決め、xyflow は描画とビューポートだけ担当する」という境界**が引けた。乗り換えるとしても差し替わるのは描画層だけ。
- **座標の基準がずれる罠**: 旧SVG は `y` を**ピルの中心**として持ち `foreignObject` に `y - h/2` を渡していたが、**xyflow のノード座標は左上基準**。`layoutTree()` の中で吸収した。
- **ノードのドラッグ移動を入れなかった理由**: 位置を保存する DB 列も API も無いため、動かしてもリロードで戻る＝**壊れて見える**。保存まで作るならマイグレーションから必要で、このスライスの粒度を超える。あわせて `nodesDraggable={false}` とし、`useNodesState` によるローカル状態も持たせていない——**ノード位置はサーバーデータから導出される値であって編集対象ではない**ので、状態を持つと真実が二重化する。
- **ミニマップを入れなかった理由**: 右ペインが 380px しかなく、俯瞰の縮図がその一角をさらに食う。全体を見たいときは全画面（`⤢`）と Fit View ボタンがある。
- **見た目を維持できた理由**: 旧実装のピルは `foreignObject` の中の `<div className="mm-pill">`＝ただの HTML で、**xyflow のカスタムノードも普通の React コンポーネント**。`PillNode.tsx` にマークアップごと移すだけで root のグラデーション・`今` バッジ・経路ハイライトの CSS がそのまま効いた。エッジも、旧SVG が手書きしていた三次ベジェ `C mx y1, mx y2` は、**接続点（Handle）を左右に置いたときの xyflow のデフォルト bezier と同じ式**なので曲線の形も変わらない。
- **`fitView` は `maxZoom: 1` で頭を打たせる**: 最初 `fitViewOptions` を素で渡したら、**ノードが1つだけのテーマでピルが `maxZoom` まで巨大に引き伸ばされた**（「収める」は「余白があれば拡大する」でもある）。初期フィットだけ 1:1 で頭打ちにし、ユーザーの手動ズームは 2 まで許す形に分けた。
- **`key={selectedProjectId}` の粒度**: テーマを切り替えたときは別の木なので remount して fitView し直したいが、**枝を作ったときに視点がリセットされるのは困る**（見ていた場所を失う）。key をプロジェクト単位にすることで両立した。ブラウザで、枝作成の前後に `.react-flow__viewport` の `transform` が完全に一致することを確認済み。`<ChatPanel key={selectedNodeId}>`（6-3）と同じイディオム。
- **CSS の読み込み順**: `@xyflow/react/dist/style.css` を `main.tsx` で**自前の `styles.css` より前に** import する。逆だとライブラリ側が後勝ちして上書きしてしまう。
- **`.mm-wrap` は `overflow: hidden` ＋確定した高さ**: パンがスクロールの役目を引き継ぐのでスクロールバーは邪魔になるだけ。加えて **xyflow はコンテナのサイズを実測する**ので、高さが確定していないと 0 になる。既存の flex（`.right-pane` → `flex:1; min-height:0`）が高さを渡していることを確認し、マップの開閉トグル（`display:none` ⇄ `block`）でも潰れないことをブラウザで検証した。
- **`large` prop が不要になった**: 全画面時に px を大きくする回避策だったが、**fitView が倍率を正規化するので効果が打ち消される**。ズームの導入で存在理由が消えたため削除した。
- **アトリビューション**: xyflow は MIT だが右下の "React Flow" 表示の非表示化（`proOptions.hideAttribution`）は有償向け機能なので、**表示を残す**。

**依存追加の責任（Step5 の `composer audit` と同じ確認）**:
- **`npm view` の直接依存だけ見ると3つだが、実際に増えたのは 20 パッケージ**。`@xyflow/system` が `d3-zoom`・`d3-drag`・`d3-selection`・`d3-interpolate`・`d3-transition` とその `@types` を連れてくるため。**xyflow のパン/ズームの実体は d3-zoom** で、「実績のある実装が手に入る」と言うときの中身はこれ。
- **`npm audit` は導入前と同じ 2 high（`react-router` の RSC モード専用・6-1 で「クライアント専用SPAには該当しない」と判断済み）のまま**で、xyflow 由来の新規 advisory はゼロ。
- 本番バンドルは 426 KB（gzip 137 KB）。

**嵌まりどころ（記録）**: **dev サーバを起動したまま依存を追加したら、Vite の依存最適化が走り直して React が二重に読み込まれ**、`Invalid hook call` が大量に出て `<ReactFlow>` がクラッシュした。コード側の問題ではなく、`node_modules/.vite` を消して dev サーバを再起動したら消えた。読み込まれている dep のハッシュが混在していること（`?v=70a76a9d` と `?v=815b94ac`）が手掛かり。

**検証（ブラウザ実機・課金ゼロ）**: 変更前後を並べて比較し、**変更前は4階層目が右端で切れて見えなかったツリーが、変更後は開いた瞬間に全体が収まる**ことを確認。ドラッグ量とビューポートの `translate` 差分が一致（-96,-80 CSS px、scale 不変）＝パンが正確／ホイールで 0.52→0.78 かつ `translate` も動く＝カーソル中心のズーム／ズームボタン ×1.2／Fit View／ノードクリックでチャット・パンくず・`current`・経路エッジが更新され**視点は保持**／テーマ切替で別ツリーにフィットし直す／枝作成で視点が完全保持（transform 一致）／全画面でもパンとクリックが動きモーダルが誤って閉じない／マップの開閉で潰れない／**コンソールエラーなし**。`artisan test` **61件緑**、`npm run build` 通過。**AI への実送信は行っていない**（描画層のみの変更で、Step5 の同期フローは 6-3 で実送信検証済みのため）。

### Step6 スライス3: 書き込み系（チャット送信・枝作成・テーマ作成）

**採用**: 楽観的更新でチャット送信、枝のタイトルはユーザー入力、テーマ作成時に根ノードも作る。

- **楽観的更新を選んだ理由**: AI応答は10〜30秒かかる。送信した瞬間に自分の発話を出し、AI側は「考え中…」を表示することで、待ち時間の体感が大きく変わる。
- **⚠️ エラー時に「ロールバックしない」判断（このスライスの肝）**: 楽観的更新の定石は `onError` でスナップショットに巻き戻すことだが、**ここではあえて外した**。Step5 でバックエンドを「**AI失敗時もユーザー発話は保存する**」（学習履歴＝コアバリューを失わない）設計にしたため、巻き戻すと画面とサーバーが食い違う。代わりに `invalidateQueries` で再取得し、サーバーの真実（発話は残り AI 応答は無い）に合わせる。リクエストが届かなかった場合も再取得なら正しく消えるので、両方のケースで正しい。**フロントの定石がバックエンドの設計判断によって変わった例**。
  - ブラウザで実証済み: キー未設定で送信 → `POST /chat` 502 → `GET /messages` 200 → **ユーザー発話が画面に残る**。
- **「考え中…」をキャッシュに入れない**: 偽の assistant 発話をキャッシュに書くとサーバーの状態と乖離するため、`mutation.isPending` を見て `ChatPanel` 側で描画するだけにした。キャッシュには「保存された事実」だけを置く。
- **`setQueryData` の罠**: `useQuery` の `select` は表示用の変換で、**キャッシュには生のレスポンス `{data: [...]}` が入る**。`setQueryData` も同じ封筒の形で書かないと壊れる。
- **枝のタイトルをユーザーに入力させる**: Phase1 の「**自分の手で構造化する行為自体が学習効果**」というコアの考え方に合致する。空で作れる方が手軽だが、樹形図が「無題」だらけになると地図として機能しない。`window.prompt` ではなくインライン入力にしたのは、見た目とテスト容易性のため。
- **根ノードは誰が作るか → フロント**: `POST /projects` はプロジェクトを作るだけで、ノードが無いと会話を始められない。バックエンドで自動生成する案もあったが、**`POST /projects` を副作用のない素直な作成のまま保つ**ため、フロントがテーマ作成directlyの直後に根ノードを作る（`useCreateProject` が2リクエストを順に投げる）。
- **ノード切替でチャット状態をリセット**: `<ChatPanel key={selectedNodeId}>` で remount する。実装中、別ノードへ移動しても前のノードのエラーが残るバグが出たため。下書きと開きかけの枝フォームも同時にクリアされる。

**検証**: 課金ゼロの範囲（枝作成→ツリー更新→パンくずが1段深く／テーマ作成→根ノード生成→即会話可能／502時に発話が残る／ノード切替でリセット）をブラウザで確認したうえで、**実キーで1回だけ実送信**し `POST /chat` 201・DBに user/assistant 2件保存・画面表示まで確認（Step5 の同期フローがブラウザから通しで動くことの実証）。`artisan test` 61件緑、`npm run build` 通過。

### Step6 スライス2: メイン画面を実データに接続（TanStack Query / path API / シーダー）

**採用**: TanStack Query でサーバー状態を管理、パンくずは `/nodes/{id}/path`（再帰CTE）、検証データはシーダー。

- **なぜ TanStack Query か（vs Context+useState 自前）**: 一覧・ローディング・エラー・再取得を宣言的に書ける。何より**サーバー状態とクライアント状態を分離**できる — 「テーマ/ノードの一覧と発話」はサーバーが持つ真実（Query がキャッシュ）、「今どのテーマ・どのノードを見ているか」は UI の関心事（`SelectionContext`）。プロトタイプの `store.tsx` は両者を1つの useState に混ぜていたが、API 接続すると性質が違うことが明確になる。
- **実際に効いた利点（重複排除）**: パンくず（`ChatPanel`）とマインドマップの経路ハイライト（`MindMap`）は**どちらも同じ `/path` を必要とする**。自前実装なら二重取得を自分で防ぐ必要があるが、Query は同じキーの同時リクエストを1本にまとめる。ネットワークで `/api/nodes/3/path` が1回だけ飛ぶことを確認済み。
- **なぜパンくずを API で取るか（vs クライアント側で導出）**: ツリー全ノードは既に手元にあるので `parent_id` を辿れば追加通信ゼロで作れる。それでも API を選んだのは、**自作した再帰CTEが実際に使われる構成にする**ため。トレードオフはノード選択ごとに1リクエスト増えること。なお全ツリーの取得自体は `GET /projects/{id}/nodes` 1本で、木の組み立てはクライアント側（`src/tree.ts`）＝Phase6 の「隣接リストを一括取得してアプリ側で組み立て」に忠実。
- **シーダー（CHECKLIST 2章の消化）**: Phase1 の痛みのエピソード（Laravel→Eloquent→クエリ生成→**PDO で脱線**、根から**マイグレーション**へ別方向）をそのままデータ化。**`branch_from_message_id` を実データで検証**でき、根が2つの子を持つ実際の分岐が描画される。`firstOrCreate` ＋「既にプロジェクトがあれば何もしない」で**追加的**にし、開発中の実アカウントを壊さずに `db:seed` を何度でも流せる。

**実装中に見つけて直した2つのバグ（どちらも TanStack Query 特有）**:
1. **無効化したクエリが永久に `isPending`**: テーマ未選択時 `useNodes(null)` は `enabled: false` になるが、v5 では「まだデータが無い」＝ `isPending` のままなので、マインドマップが「読み込み中…」で固まった。**未選択を先に判定**してから `isPending` を見るよう修正。
2. **ユーザー切替でキャッシュが漏れる**: 別アカウントでログインし直すと、前のユーザーの `['projects']` キャッシュがそのまま表示された（`staleTime` 中は再取得されないため）。**login/register/logout で `queryClient.clear()`** を呼ぶよう修正。ブラウザで双方向（空アカウント↔データありアカウント）を検証済み。これはキャッシュを持つ以上必ず必要になる後始末で、自前実装なら気づきにくい類のバグ。

**検証（ブラウザ実機）**: デモユーザーでテーマ2件・5ノードのツリー描画・根の自動選択 / 最深ノードをクリック→**パンくずが4階層**・発話が切替 / テーマ切替でツリーと発話が入替 / `/path` が重複しない / 空アカウントで3ペインとも空状態が壊れない / コンソールエラーなし。`artisan test` 61件緑、`npm run build` 通過。

### Step6 スライス1: フロント土台＋認証（frontend/ 昇格・APIクライアント・ログイン画面）

**採用**: `prototype/` を `frontend/` に**コピー**して昇格、React Router 導入、**Vite proxy を使わず直接 CORS で API を叩く**。

- **なぜ Vite dev proxy を使わないか**: proxy を挟むとブラウザからは同一オリジンに見え、**Step3 で設定した CORS・`SANCTUM_STATEFUL_DOMAINS`・`SESSION_DOMAIN` が一度も使われず検証されない**（本番で別オリジン配信にした瞬間に初めて壊れる）。5173→8000 を直接叩くことで、開発中に常にクロスオリジン cookie 認証の経路を通す。実際ブラウザ検証で CORS プリフライト（`OPTIONS` → 204）が発生し、`Access-Control-Allow-Credentials: true` が返り、cookie が乗ることを確認した。
- **なぜポートが違うのに cookie が共有されるか**: **cookie はオリジンと違ってポートを区別しない**。`SESSION_DOMAIN=localhost` により 5173 と 8000 で同じ cookie が使われる。これが SPA cookie 認証がローカルで成立する理由。
- **CSRF cookie の罠**: `XSRF-TOKEN` cookie の値は **URL エンコードされている**ため、`decodeURIComponent` してから `X-XSRF-TOKEN` ヘッダに載せないと CSRF 検証に落ちる。この処理は `src/api/client.ts` に閉じ込め、呼び出し側は意識しない。
- **`credentials: 'include'` が必須**: これが無いとブラウザは別オリジンへ cookie を送らない。API 側の `supports_credentials => true` と対になる設定。
- **認証状態に `loading` を持つ理由**: 起動時に `GET /api/me` でセッションを復元するが、その解決前に「未認証」と判定するとログイン画面が一瞬フラッシュしてしまう。`loading / authenticated / guest` の3状態にし、`loading` 中はルートガードで待つ。
- **React Router を選んだ理由**: URL で画面を分けることで、リロード復帰・ブラウザの戻る・未認証時のリダイレクトが標準的な形で書ける。状態フラグでの出し分けは依存ゼロだが、これらが全て自前実装になる。
- **昇格は移動でなくコピー**: このリポジトリは **git 管理されていない**ため、移動は失敗時に戻せない。`prototype/` を残し、案1〜6の比較履歴も保全した。

**検証（ブラウザ実機）**: 未認証で `/`→`/login` リダイレクト / サインアップ 201→`/` 遷移 / **リロードで `/api/me` 200 → セッション復元** / ログアウト 204→`/login` / 誤パスワードで 422 をフィールド下に表示 / 正パスワードで 200。コンソールエラーなし、`npm run build`（`tsc -b`）通過。

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
