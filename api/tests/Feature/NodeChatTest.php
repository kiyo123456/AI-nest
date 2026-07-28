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

it('rejects content longer than the column can hold', function () {
    $user = User::factory()->create();
    $node = chatNodeOwnedBy($user);

    // `messages.content` is a TEXT column (65,535 bytes); the 10,000-character
    // rule keeps a multi-byte message well inside it, so overflow is a 422
    // rather than a database error surfacing as a 500.
    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => str_repeat('あ', 10_001)])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('content');

    $this->assertDatabaseCount('messages', 0);
});

it('accepts content exactly at the limit', function () {
    $user = User::factory()->create();
    $node = chatNodeOwnedBy($user);
    fakeAiReply();

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => str_repeat('あ', 10_000)])
        ->assertCreated();
});

it('throttles a second chat within the minute', function () {
    $user = User::factory()->create();
    $node = chatNodeOwnedBy($user);

    // Exactly one call is expected: the throttled request must never reach
    // the provider, which is what makes it cost nothing.
    test()->mock(AnthropicClient::class)
        ->shouldReceive('chat')
        ->once()
        ->andReturn('AI からの回答');

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => '1回目'])
        ->assertCreated();

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => '2回目'])
        ->assertStatus(429);

    // The blocked turn is not stored either — the request never got that far.
    $this->assertDatabaseMissing('messages', ['content' => '2回目']);
});

it('keeps counting the daily allowance across minutes', function () {
    // Lowered here rather than sending 50 requests; the limiter reads config
    // per request, so the production numbers stay untouched.
    config()->set('services.anthropic.rate_limit.per_minute', 1);
    config()->set('services.anthropic.rate_limit.per_day', 2);

    $user = User::factory()->create();
    $node = chatNodeOwnedBy($user);
    fakeAiReply();

    // Time has to move between requests, and that is the whole point: the
    // daily tally must survive the per-minute window expiring. Sending three
    // requests back to back would pass even if both windows shared one
    // counter, because nothing would have expired yet.
    $this->actingAs($user)->postJson("/api/nodes/{$node->id}/chat", ['content' => '1'])->assertCreated();

    $this->travel(61)->seconds();
    $this->actingAs($user)->postJson("/api/nodes/{$node->id}/chat", ['content' => '2'])->assertCreated();

    $this->travel(61)->seconds();
    $this->actingAs($user)->postJson("/api/nodes/{$node->id}/chat", ['content' => '3'])->assertStatus(429);
});

it('counts the chat allowance per user, not per connection', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $node = chatNodeOwnedBy($user);
    $otherNode = chatNodeOwnedBy($other);
    fakeAiReply();

    $this->actingAs($user)
        ->postJson("/api/nodes/{$node->id}/chat", ['content' => 'hi'])
        ->assertCreated();

    // Same IP, different account: keying the limiter by user (not by IP) means
    // their allowance is untouched, so this must not be throttled.
    $this->actingAs($other)
        ->postJson("/api/nodes/{$otherNode->id}/chat", ['content' => 'hi'])
        ->assertCreated();
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
