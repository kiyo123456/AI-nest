<?php

use App\Exceptions\AiRequestException;
use App\Models\Message;
use App\Models\Node;
use App\Models\Project;
use App\Models\User;
use App\Services\AnthropicClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

/**
 * Create a node owned by the given user.
 */
function chatNodeOwnedBy(User $user): Node
{
    return Node::factory()->for(Project::factory()->for($user))->create();
}

/**
 * Swap the AI boundary for a stub that returns a fixed reply.
 * Mocking our own wrapper (not the SDK's HTTP layer) keeps the seam stable
 * and guarantees no real API call — and therefore no cost — during tests.
 */
function fakeAiReply(string $reply = 'AI からの回答'): void
{
    test()->mock(AnthropicClient::class)
        ->shouldReceive('chat')
        ->andReturn($reply);
}

it('rejects unauthenticated chat requests', function () {
    $node = Node::factory()->create();

    postJson("/api/nodes/{$node->id}/chat", ['content' => 'hi'])->assertUnauthorized();
});

it('stores the question and the AI reply', function () {
    $user = User::factory()->create();
    $node = chatNodeOwnedBy($user);
    fakeAiReply('Eloquent は Laravel の ORM です。');

    $response = $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => 'Eloquent とは？']);

    $response->assertCreated()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.role', 'user')
        ->assertJsonPath('data.0.content', 'Eloquent とは？')
        ->assertJsonPath('data.1.role', 'assistant')
        ->assertJsonPath('data.1.content', 'Eloquent は Laravel の ORM です。');

    $this->assertDatabaseHas('messages', ['node_id' => $node->id, 'role' => 'user']);
    $this->assertDatabaseHas('messages', ['node_id' => $node->id, 'role' => 'assistant']);
});

it('sends the ancestor context to the AI, cut at each branch point', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    // Root A with a branch point at a2; a3 comes after the split.
    $root = Node::factory()->for($project)->create();
    $a1 = Message::factory()->for($root)->create(['role' => 'user', 'content' => 'a1']);
    $a2 = Message::factory()->for($root)->create(['role' => 'assistant', 'content' => 'a2']);
    Message::factory()->for($root)->create(['role' => 'user', 'content' => 'a3']);

    $branch = Node::factory()->for($project)->create([
        'parent_id' => $root->id,
        'branch_from_message_id' => $a2->id,
    ]);

    $captured = null;
    $this->mock(AnthropicClient::class)
        ->shouldReceive('chat')
        ->andReturnUsing(function (Collection $context) use (&$captured): string {
            $captured = $context;

            return 'ok';
        });

    $this->actingAs($user)
        ->postJson("/api/nodes/{$branch->id}/chat", ['content' => '続きを教えて'])
        ->assertCreated();

    // Ancestor messages up to the branch point, then this node's own turn.
    // a3 (posted after the split) must not leak into the context.
    expect($captured->pluck('content')->all())
        ->toBe([$a1->content, $a2->content, '続きを教えて']);
});

it('keeps the user message when the AI call fails', function () {
    $user = User::factory()->create();
    $node = chatNodeOwnedBy($user);

    $this->mock(AnthropicClient::class)
        ->shouldReceive('chat')
        ->andThrow(new AiRequestException('The AI provider returned an error.'));

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => '質問'])
        ->assertStatus(502);

    // Deliberate: learning history is never rolled back, so the user can retry.
    $this->assertDatabaseHas('messages', [
        'node_id' => $node->id,
        'role' => 'user',
        'content' => '質問',
    ]);
    $this->assertDatabaseMissing('messages', ['node_id' => $node->id, 'role' => 'assistant']);
});

it('rejects a chat request without content', function () {
    $user = User::factory()->create();
    $node = chatNodeOwnedBy($user);

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", [])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('content');
});

it('forbids chatting in another user\'s node', function () {
    $user = User::factory()->create();
    $node = Node::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => 'hi'])
        ->assertForbidden();

    $this->assertDatabaseCount('messages', 0);
});
