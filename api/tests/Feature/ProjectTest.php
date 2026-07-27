<?php

use App\Models\Message;
use App\Models\Node;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

uses(RefreshDatabase::class);

it('rejects unauthenticated access to every project endpoint', function () {
    $project = Project::factory()->create();

    getJson('/api/projects')->assertUnauthorized();
    postJson('/api/projects', ['project_name' => 'x'])->assertUnauthorized();
    getJson("/api/projects/{$project->id}")->assertUnauthorized();
    putJson("/api/projects/{$project->id}", ['project_name' => 'x'])->assertUnauthorized();
    deleteJson("/api/projects/{$project->id}")->assertUnauthorized();
});

it('lists only the current user\'s projects with a node count', function () {
    $user = User::factory()->create();
    $mine = Project::factory()->for($user)->create();
    Node::factory()->for($mine)->count(2)->create();
    $others = Project::factory()->create();

    $response = $this->actingAs($user)->getJson('/api/projects');

    $response->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $mine->id)
        ->assertJsonPath('data.0.nodes_count', 2);

    expect(collect($response->json('data'))->pluck('id'))
        ->not->toContain($others->id);
});

it('creates a project owned by the authenticated user', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/projects', ['project_name' => 'Laravel の DB'])
        ->assertCreated()
        ->assertJsonPath('data.project_name', 'Laravel の DB');

    $this->assertDatabaseHas('projects', [
        'project_name' => 'Laravel の DB',
        'user_id' => $user->id,
    ]);
});

it('rejects project creation without a name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/projects', [])
        ->assertStatus(422)
        ->assertJsonValidationErrorFor('project_name');
});

it('shows a project the user owns', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->getJson("/api/projects/{$project->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $project->id);
});

it('forbids viewing another user\'s project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/projects/{$project->id}")
        ->assertForbidden();
});

it('updates a project the user owns', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create(['project_name' => 'old']);

    $this->actingAs($user)
        ->putJson("/api/projects/{$project->id}", ['project_name' => 'new'])
        ->assertOk()
        ->assertJsonPath('data.project_name', 'new');

    $this->assertDatabaseHas('projects', ['id' => $project->id, 'project_name' => 'new']);
});

it('forbids updating another user\'s project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->create(['project_name' => 'untouched']);

    $this->actingAs($user)
        ->putJson("/api/projects/{$project->id}", ['project_name' => 'hacked'])
        ->assertForbidden();

    $this->assertDatabaseHas('projects', ['id' => $project->id, 'project_name' => 'untouched']);
});

it('deletes a project the user owns and cascades to nodes and messages', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $node = Node::factory()->for($project)->create();
    $message = Message::factory()->for($node)->create();

    $this->actingAs($user)
        ->deleteJson("/api/projects/{$project->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('projects', ['id' => $project->id]);
    $this->assertDatabaseMissing('nodes', ['id' => $node->id]);
    $this->assertDatabaseMissing('messages', ['id' => $message->id]);
});

it('forbids deleting another user\'s project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->create();

    $this->actingAs($user)
        ->deleteJson("/api/projects/{$project->id}")
        ->assertForbidden();

    $this->assertDatabaseHas('projects', ['id' => $project->id]);
});
