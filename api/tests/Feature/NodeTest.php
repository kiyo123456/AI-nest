<?php

use App\Models\Message;
use App\Models\Node;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

it('rejects unauthenticated access to node endpoints', function () {
    $project = Project::factory()->create();
    $node = Node::factory()->for($project)->create();

    getJson("/api/projects/{$project->id}/nodes")->assertUnauthorized();
    postJson("/api/projects/{$project->id}/nodes", [])->assertUnauthorized();
    getJson("/api/nodes/{$node->id}")->assertUnauthorized();
    deleteJson("/api/nodes/{$node->id}")->assertUnauthorized();
});

it('lists nodes of a project the user owns with counts', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $root = Node::factory()->for($project)->create();
    Node::factory()->for($project)->create(['parent_id' => $root->id]);

    $this->actingAs($user)
        ->getJson("/api/projects/{$project->id}/nodes")
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.children_count', 1);
});

it('forbids listing nodes of another user\'s project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/projects/{$project->id}/nodes")
        ->assertForbidden();
});

it('creates a root node in the project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->postJson("/api/projects/{$project->id}/nodes", ['summary' => 'Laravel の DB'])
        ->assertCreated()
        ->assertJsonPath('data.project_id', $project->id)
        ->assertJsonPath('data.parent_id', null);

    $this->assertDatabaseHas('nodes', [
        'project_id' => $project->id,
        'summary' => 'Laravel の DB',
        'parent_id' => null,
    ]);
});

it('creates a child node branching from a parent message', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $root = Node::factory()->for($project)->create();
    $message = Message::factory()->for($root)->create();

    $this->actingAs($user)
        ->postJson("/api/projects/{$project->id}/nodes", [
            'summary' => 'branch',
            'parent_id' => $root->id,
            'branch_from_message_id' => $message->id,
        ])
        ->assertCreated()
        ->assertJsonPath('data.parent_id', $root->id)
        ->assertJsonPath('data.branch_from_message_id', $message->id);
});

it('rejects a parent_id that belongs to a different project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $foreignNode = Node::factory()->create(); // node in some other project

    $this->actingAs($user)
        ->postJson("/api/projects/{$project->id}/nodes", [
            'summary' => 'x',
            'parent_id' => $foreignNode->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('parent_id');
});

it('rejects a branch_from_message_id outside the parent node\'s thread', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $root = Node::factory()->for($project)->create();
    $otherNode = Node::factory()->for($project)->create();
    $strayMessage = Message::factory()->for($otherNode)->create();

    $this->actingAs($user)
        ->postJson("/api/projects/{$project->id}/nodes", [
            'summary' => 'x',
            'parent_id' => $root->id,
            'branch_from_message_id' => $strayMessage->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('branch_from_message_id');
});

it('forbids creating a node in another user\'s project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->create();

    $this->actingAs($user)
        ->postJson("/api/projects/{$project->id}/nodes", ['summary' => 'x'])
        ->assertForbidden();
});

it('shows and updates a node the user owns', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $node = Node::factory()->for($project)->create(['summary' => 'old']);

    $this->actingAs($user)
        ->getJson("/api/nodes/{$node->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $node->id);

    $this->actingAs($user)
        ->putJson("/api/nodes/{$node->id}", ['summary' => 'new'])
        ->assertOk()
        ->assertJsonPath('data.summary', 'new');

    $this->assertDatabaseHas('nodes', ['id' => $node->id, 'summary' => 'new']);
});

it('forbids viewing or updating another user\'s node', function () {
    $user = User::factory()->create();
    $node = Node::factory()->create();

    $this->actingAs($user)->getJson("/api/nodes/{$node->id}")->assertForbidden();
    $this->actingAs($user)->putJson("/api/nodes/{$node->id}", ['summary' => 'x'])->assertForbidden();
});

it('deletes a leaf node', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $node = Node::factory()->for($project)->create();

    $this->actingAs($user)
        ->deleteJson("/api/nodes/{$node->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('nodes', ['id' => $node->id]);
});

it('refuses to delete a node that has children (409)', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $root = Node::factory()->for($project)->create();
    $child = Node::factory()->for($project)->create(['parent_id' => $root->id]);

    $this->actingAs($user)
        ->deleteJson("/api/nodes/{$root->id}")
        ->assertStatus(409);

    $this->assertDatabaseHas('nodes', ['id' => $root->id]);
    $this->assertDatabaseHas('nodes', ['id' => $child->id]);
});

it('forbids deleting another user\'s node', function () {
    $user = User::factory()->create();
    $node = Node::factory()->create();

    $this->actingAs($user)
        ->deleteJson("/api/nodes/{$node->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('nodes', ['id' => $node->id]);
});
