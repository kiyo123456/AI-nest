export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
};

export type TreeNode = {
  id: string;
  treeId: string;
  parentId: string | null;
  /** 親スレッドのどのメッセージから枝分かれしたか（文脈継承範囲） */
  branchFromIndex: number | null;
  title: string;
  messages: Message[];
};

export type Tree = {
  id: string;
  title: string;
};

let seq = 100;
export const nextId = (prefix: string) => `${prefix}_${++seq}`;

export const trees: Tree[] = [
  { id: "t_laravel", title: "Laravel を学ぶ" },
  { id: "t_react", title: "React の状態管理" },
  { id: "t_infra", title: "インフラ入門" },
];

export const initialNodes: TreeNode[] = [
  {
    id: "n_root",
    treeId: "t_laravel",
    parentId: null,
    branchFromIndex: null,
    title: "Laravel の DB が知りたい",
    messages: [
      { id: "m1", role: "user", content: "Laravel でデータベースを扱うには何から学べばいい？" },
      {
        id: "m2",
        role: "assistant",
        content:
          "まず Eloquent ORM を理解するのが近道です。モデル・マイグレーション・リレーションの3つが基本になります。",
      },
      { id: "m3", role: "user", content: "なるほど。次は Eloquent を詳しく知りたい。" },
    ],
  },
  {
    id: "n_eloquent",
    treeId: "t_laravel",
    parentId: "n_root",
    branchFromIndex: 2,
    title: "Eloquent ORM とは",
    messages: [
      { id: "m4", role: "user", content: "Eloquent ORM って具体的に何をしてくれるの？" },
      {
        id: "m5",
        role: "assistant",
        content:
          "テーブルを PHP のオブジェクトとして扱える仕組みです。SQL を書かずに User::find(1) のように操作できます。内部ではクエリビルダが SQL を生成しています。",
      },
      { id: "m6", role: "user", content: "内部の SQL 生成ってどうなってるの？" },
    ],
  },
  {
    id: "n_query",
    treeId: "t_laravel",
    parentId: "n_eloquent",
    branchFromIndex: 2,
    title: "内部のクエリ生成",
    messages: [
      { id: "m7", role: "user", content: "クエリビルダはどうやって SQL を組み立てている？" },
      {
        id: "m8",
        role: "assistant",
        content:
          "メソッドチェーンで条件を貯めて、最後に文字列の SQL とバインド値に変換します。ここで PDO のプリペアドステートメントが使われます。",
      },
      { id: "m9", role: "user", content: "PDO って何？ そもそも DB 接続の低レイヤーが気になってきた…" },
    ],
  },
  {
    id: "n_pdo",
    treeId: "t_laravel",
    parentId: "n_query",
    branchFromIndex: 2,
    title: "PDO / DB低レイヤー（脱線）",
    messages: [
      { id: "m10", role: "user", content: "PDO とコネクションプールの仕組みを教えて" },
      {
        id: "m11",
        role: "assistant",
        content:
          "PDO は PHP の DB 抽象化層で…（ここまで来ると元の『Laravelの使い方』からかなり深く潜っています）",
      },
    ],
  },
  {
    id: "n_migration",
    treeId: "t_laravel",
    parentId: "n_root",
    branchFromIndex: 2,
    title: "マイグレーション（別方向）",
    messages: [
      { id: "m12", role: "user", content: "マイグレーションってどう書くの？" },
      {
        id: "m13",
        role: "assistant",
        content:
          "Schema::create でテーブル定義を PHP で記述します。up/down でロールバックも管理できます。",
      },
    ],
  },
];
