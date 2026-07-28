<?php

use App\Models\Message;
use App\Models\Node;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/**
 * Create a node owned by the given user.
 */
function nodeOwnedBy(User $user): Node
{
    return Node::factory()->for(Project::factory()->for($user))->create();
}

it('rejects unauthenticated access to message endpoints', function () {
    $node = Node::factory()->create();

    getJson("/api/nodes/{$node->id}/messages")->assertUnauthorized();
    postJson("/api/nodes/{$node->id}/messages", [])->assertUnauthorized();
});

it('lists the messages in a node the user owns', function () {
    $user = User::factory()->create();
    $node = nodeOwnedBy($user);
    Message::factory()->for($node)->count(3)->create();

    $this->actingAs($user)
        ->getJson("/api/nodes/{$node->id}/messages")
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

it('forbids listing messages of another user\'s node', function () {
    $user = User::factory()->create();
    $node = Node::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/nodes/{$node->id}/messages")
        ->assertForbidden();
});

it('appends a message to a node the user owns', function () {
    $user = User::factory()->create();
    $node = nodeOwnedBy($user);

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/messages", [
            'role' => 'user',
            'content' => 'Eloquent とは？',
        ])
        ->assertCreated()
        ->assertJsonPath('data.node_id', $node->id)
        ->assertJsonPath('data.role', 'user');

    $this->assertDatabaseHas('messages', [
        'node_id' => $node->id,
        'role' => 'user',
        'content' => 'Eloquent とは？',
    ]);
});

it('rejects a message with an invalid role', function () {
    $user = User::factory()->create();
    $node = nodeOwnedBy($user);

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/messages", [
            'role' => 'system',
            'content' => 'x',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('role');
});

it('rejects a message without content', function () {
    $user = User::factory()->create();
    $node = nodeOwnedBy($user);

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/messages", ['role' => 'user'])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('content');
});

it('rejects a message longer than the column can hold', function () {
    $user = User::factory()->create();
    $node = nodeOwnedBy($user);

    // Same cap as the chat endpoint: without it a long multi-byte message
    // overflows the TEXT column and the database error surfaces as a 500.
    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/messages", [
            'role' => 'user',
            'content' => str_repeat('あ', 10_001),
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('content');

    $this->assertDatabaseCount('messages', 0);
});

it('forbids appending a message to another user\'s node', function () {
    $user = User::factory()->create();
    $node = Node::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/messages", [
            'role' => 'user',
            'content' => 'x',
        ])
        ->assertForbidden();
});
