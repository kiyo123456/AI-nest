<?php

use App\Models\Message;
use App\Models\Node;
use App\Models\Project;
use App\Models\User;
use App\Services\ContextBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

use function Pest\Laravel\getJson;

uses(RefreshDatabase::class);

/**
 * Append a message to a node and return it (ids increase in call order).
 */
function addMessage(Node $node, string $content): Message
{
    return Message::factory()->for($node)->create([
        'role' => 'user',
        'content' => $content,
    ]);
}

/**
 * Build the A → B → D chain (each branch point is a message in its parent):
 *   A: a1, a2, a3   B branches at a2: b1, b2, b3   D branches at b2: d1, d2
 * Returns ['project','A','B','D','messages'=>[a1,a2,b1,b2,d1,d2]].
 *
 * @return array{project: Project, A: Node, B: Node, D: Node, messages: array<Message>}
 */
function buildBranchingTree(User $user): array
{
    $project = Project::factory()->for($user)->create();

    $a = Node::factory()->for($project)->create(['summary' => 'A']);
    $a1 = addMessage($a, 'a1');
    $a2 = addMessage($a, 'a2');
    addMessage($a, 'a3'); // after the branch point — excluded from D's context

    $b = Node::factory()->for($project)->create([
        'summary' => 'B',
        'parent_id' => $a->id,
        'branch_from_message_id' => $a2->id,
    ]);
    $b1 = addMessage($b, 'b1');
    $b2 = addMessage($b, 'b2');
    addMessage($b, 'b3'); // after the branch point — excluded

    $d = Node::factory()->for($project)->create([
        'summary' => 'D',
        'parent_id' => $b->id,
        'branch_from_message_id' => $b2->id,
    ]);
    $d1 = addMessage($d, 'd1');
    $d2 = addMessage($d, 'd2');

    return ['project' => $project, 'A' => $a, 'B' => $b, 'D' => $d, 'messages' => [$a1, $a2, $b1, $b2, $d1, $d2]];
}

/**
 * Build a straight chain of `$depth` nodes, each holding two messages and
 * branching off its parent's first message. Returns the deepest node.
 */
function buildChain(User $user, int $depth): Node
{
    $project = Project::factory()->for($user)->create();
    $parent = null;
    $branchFrom = null;

    for ($i = 0; $i < $depth; $i++) {
        $node = Node::factory()->for($project)->create([
            'summary' => "n{$i}",
            'parent_id' => $parent?->id,
            'branch_from_message_id' => $branchFrom?->id,
        ]);
        $branchFrom = addMessage($node, "m{$i}a");
        addMessage($node, "m{$i}b");
        $parent = $node;
    }

    return $parent;
}

it('returns the ancestor path root → node', function () {
    $user = User::factory()->create();
    $tree = buildBranchingTree($user);

    $response = $this->actingAs($user)->getJson("/api/nodes/{$tree['D']->id}/path");

    $response->assertOk()->assertJsonCount(3, 'data');
    expect(collect($response->json('data'))->pluck('id')->all())
        ->toBe([$tree['A']->id, $tree['B']->id, $tree['D']->id]);
});

it('returns a single-element path for a root node', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $root = Node::factory()->for($project)->create();

    $this->actingAs($user)
        ->getJson("/api/nodes/{$root->id}/path")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $root->id);
});

it('assembles the AI context up to each branch point', function () {
    $user = User::factory()->create();
    $tree = buildBranchingTree($user);
    [$a1, $a2, $b1, $b2, $d1, $d2] = $tree['messages'];

    $response = $this->actingAs($user)->getJson("/api/nodes/{$tree['D']->id}/context");

    $response->assertOk();
    // a3 and b3 (posted after their branch points) are excluded.
    expect(collect($response->json('data'))->pluck('id')->all())
        ->toBe([$a1->id, $a2->id, $b1->id, $b2->id, $d1->id, $d2->id]);
});

it('returns all messages for a root node context', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $root = Node::factory()->for($project)->create();
    $m1 = addMessage($root, 'm1');
    $m2 = addMessage($root, 'm2');

    $response = $this->actingAs($user)->getJson("/api/nodes/{$root->id}/context");

    $response->assertOk();
    expect(collect($response->json('data'))->pluck('id')->all())->toBe([$m1->id, $m2->id]);
});

/**
 * Guards against the N+1 this used to have: the builder walked the ancestor
 * path and asked each node for its messages separately, so the query count
 * grew with the depth of the tree — and depth is exactly what this product
 * encourages. Asserting that a deep path costs the same as a shallow one
 * states "constant in depth" directly, and unlike a hard-coded number it does
 * not break if a legitimate constant query is added later.
 */
it('does not run more queries as the path gets deeper', function () {
    $user = User::factory()->create();
    $shallow = buildChain($user, 3);
    $deep = buildChain($user, 8);

    $queries = 0;
    DB::listen(function () use (&$queries): void {
        $queries++;
    });

    $builder = app(ContextBuilder::class);

    // One listener, reset between runs: listeners cannot be detached, so a
    // second DB::listen would double-count the first counter's queries.
    $queries = 0;
    $builder->build($shallow);
    $shallowQueries = $queries;

    $queries = 0;
    $builder->build($deep);
    $deepQueries = $queries;

    expect($deepQueries)->toBe($shallowQueries);
});

it('rejects unauthenticated access to path and context', function () {
    $node = Node::factory()->create();

    getJson("/api/nodes/{$node->id}/path")->assertUnauthorized();
    getJson("/api/nodes/{$node->id}/context")->assertUnauthorized();
});

it('forbids path and context on another user\'s node', function () {
    $user = User::factory()->create();
    $node = Node::factory()->create();

    $this->actingAs($user)->getJson("/api/nodes/{$node->id}/path")->assertForbidden();
    $this->actingAs($user)->getJson("/api/nodes/{$node->id}/context")->assertForbidden();
});
