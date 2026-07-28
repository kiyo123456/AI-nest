<?php

namespace Database\Seeders;

use App\Models\Message;
use App\Models\Node;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Demo data shaped like the episode behind this product: a question about
 * Laravel's DB layer that keeps drilling down until the original topic is out
 * of sight, plus a side branch heading in a different direction.
 *
 * Additive on purpose — it never deletes existing accounts, so running
 * `db:seed` against a working database is safe.
 */
class LearningTreeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'demo@example.com'],
            ['name' => 'デモユーザー', 'password' => Hash::make('password')],
        );

        // Re-seeding shouldn't stack duplicate trees on the demo account.
        if ($user->projects()->exists()) {
            return;
        }

        $this->seedLaravelTree($user);
        $this->seedReactTree($user);
    }

    /**
     * Laravel を学ぶ: root → Eloquent → クエリ生成 → PDO（深掘りの果ての脱線）
     * に加え、root から マイグレーション へ分かれる別方向の枝。
     */
    private function seedLaravelTree(User $user): void
    {
        $project = $user->projects()->create(['project_name' => 'Laravel を学ぶ']);

        $root = $project->nodes()->create(['summary' => 'Laravel の DB が知りたい']);
        $this->say($root, 'user', 'Laravel でデータベースを扱うには何から学べばいい？');
        $rootBranchPoint = $this->say(
            $root,
            'assistant',
            'まず Eloquent ORM を理解するのが近道です。モデル・マイグレーション・リレーションの3つが基本になります。',
        );
        // Posted after the split — must NOT appear in a child's AI context.
        $this->say($root, 'user', 'なるほど。次は Eloquent を詳しく知りたい。');

        $eloquent = $this->branch($project, $root, $rootBranchPoint, 'Eloquent ORM とは');
        $this->say($eloquent, 'user', 'Eloquent ORM って具体的に何をしてくれるの？');
        $eloquentBranchPoint = $this->say(
            $eloquent,
            'assistant',
            'テーブルを PHP のオブジェクトとして扱える仕組みです。SQL を書かずに User::find(1) のように操作できます。内部ではクエリビルダが SQL を生成しています。',
        );
        $this->say($eloquent, 'user', '内部の SQL 生成ってどうなってるの？');

        $query = $this->branch($project, $eloquent, $eloquentBranchPoint, '内部のクエリ生成');
        $this->say($query, 'user', 'クエリビルダはどうやって SQL を組み立てている？');
        $queryBranchPoint = $this->say(
            $query,
            'assistant',
            'メソッドチェーンで条件を貯めて、最後に文字列の SQL とバインド値に変換します。ここで PDO のプリペアドステートメントが使われます。',
        );

        $pdo = $this->branch($project, $query, $queryBranchPoint, 'PDO / DB低レイヤー（脱線）');
        $this->say($pdo, 'user', 'PDO とコネクションプールの仕組みを教えて');
        $this->say(
            $pdo,
            'assistant',
            'PDO は PHP の DB 抽象化層です。ここまで来ると、元々知りたかった「Laravel の使い方」からはかなり深く潜っています。',
        );

        // A second child of the root — same parent, so the tree actually forks.
        $migration = $this->branch($project, $root, $rootBranchPoint, 'マイグレーション（別方向）');
        $this->say($migration, 'user', 'マイグレーションってどう書くの？');
        $this->say(
            $migration,
            'assistant',
            'Schema::create でテーブル定義を PHP で記述します。up/down でロールバックも管理できます。',
        );
    }

    /**
     * A second, smaller theme so switching between themes can be exercised.
     */
    private function seedReactTree(User $user): void
    {
        $project = $user->projects()->create(['project_name' => 'React の状態管理']);

        $root = $project->nodes()->create(['summary' => '状態管理の選び方']);
        $this->say($root, 'user', 'React の状態管理は何を使えばいい？');
        $branchPoint = $this->say(
            $root,
            'assistant',
            'まずは useState と Context で足ります。サーバーから取るデータが増えてきたら、その用途に特化した仕組みを足すと整理しやすくなります。',
        );

        $server = $this->branch($project, $root, $branchPoint, 'サーバー状態の扱い');
        $this->say($server, 'user', 'サーバーから取るデータは何が違うの？');
        $this->say(
            $server,
            'assistant',
            '手元で持つ状態と違い、キャッシュ・再取得・ローディング・エラーが常について回ります。そこが分離できると画面の見通しが良くなります。',
        );
    }

    /**
     * Create a child node that branches off `$parent` at a specific message.
     * The split point is the message's identity, not its position in the thread.
     */
    private function branch(Project $project, Node $parent, Message $from, string $summary): Node
    {
        return $project->nodes()->create([
            'parent_id' => $parent->id,
            'branch_from_message_id' => $from->id,
            'summary' => $summary,
        ]);
    }

    private function say(Node $node, string $role, string $content): Message
    {
        return $node->messages()->create(['role' => $role, 'content' => $content]);
    }
}
