<?php

use App\Models\Node;
use App\Models\User;
use Database\Seeders\LearningTreeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds a branching learning tree for the demo user', function () {
    $this->seed(LearningTreeSeeder::class);

    $user = User::where('email', 'demo@example.com')->firstOrFail();
    expect($user->projects)->toHaveCount(2);

    $laravel = $user->projects()->where('project_name', 'Laravel を学ぶ')->firstOrFail();
    $root = $laravel->nodes()->whereNull('parent_id')->firstOrFail();

    // The root forks: the deep-dive chain and a second, different direction.
    expect($root->children)->toHaveCount(2);
});

it('points every branch at a real message inside its parent thread', function () {
    $this->seed(LearningTreeSeeder::class);

    $branches = Node::whereNotNull('parent_id')->get();
    expect($branches)->not->toBeEmpty();

    foreach ($branches as $branch) {
        // The split point is the message's identity, not its position.
        expect($branch->branch_from_message_id)->not->toBeNull();
        expect($branch->branchFromMessage)->not->toBeNull()
            ->and($branch->branchFromMessage->node_id)->toBe($branch->parent_id);
    }
});

it('builds the four-deep chain that ends in the off-topic node', function () {
    $this->seed(LearningTreeSeeder::class);

    $pdo = Node::where('summary', 'PDO / DB低レイヤー（脱線）')->firstOrFail();

    expect($pdo->ancestorPath()->pluck('summary')->all())->toBe([
        'Laravel の DB が知りたい',
        'Eloquent ORM とは',
        '内部のクエリ生成',
        'PDO / DB低レイヤー（脱線）',
    ]);
});

it('is safe to run twice', function () {
    $this->seed(LearningTreeSeeder::class);
    $this->seed(LearningTreeSeeder::class);

    $user = User::where('email', 'demo@example.com')->firstOrFail();
    expect($user->projects)->toHaveCount(2);
    expect(User::where('email', 'demo@example.com')->count())->toBe(1);
});
