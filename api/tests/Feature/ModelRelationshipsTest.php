<?php

use App\Models\Message;
use App\Models\Node;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('links a user to their projects', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    expect($user->projects)->toHaveCount(1)
        ->and($project->user->is($user))->toBeTrue();
});

it('links a project to its nodes', function () {
    $project = Project::factory()->create();
    $node = Node::factory()->for($project)->create();

    expect($project->nodes)->toHaveCount(1)
        ->and($node->project->is($project))->toBeTrue();
});

it('resolves the self-referencing parent/children tree', function () {
    $root = Node::factory()->create();
    $child = Node::factory()->for($root->project)->create(['parent_id' => $root->id]);

    expect($root->children)->toHaveCount(1)
        ->and($child->parent->is($root))->toBeTrue()
        ->and($root->parent)->toBeNull();
});

it('links a node to its messages', function () {
    $node = Node::factory()->create();
    $message = Message::factory()->for($node)->create();

    expect($node->messages)->toHaveCount(1)
        ->and($message->node->is($node))->toBeTrue();
});

it('records the branch point via branchFromMessage', function () {
    // Root node A with a conversation.
    $root = Node::factory()->create();
    $m2 = Message::factory()->for($root)->create(['role' => 'assistant']);

    // Child node B that branched off A at message m2.
    $branch = Node::factory()->for($root->project)->create([
        'parent_id' => $root->id,
        'branch_from_message_id' => $m2->id,
    ]);

    expect($branch->branchFromMessage->is($m2))->toBeTrue()
        ->and($branch->branchFromMessage->node->is($root))->toBeTrue();
});
