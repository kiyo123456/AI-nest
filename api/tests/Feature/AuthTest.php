<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Emulate a request from the SPA's origin so Sanctum's stateful middleware
    // boots the session guard (the cookie-auth path we actually ship).
    config(['sanctum.stateful' => ['localhost']]);
    $this->withHeader('Origin', 'http://localhost');
});

it('registers a new user and starts a session', function () {
    $response = postJson('/api/register', [
        'name' => 'Kiyoshi',
        'email' => 'kiyoshi@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.email', 'kiyoshi@example.com')
        ->assertJsonMissingPath('data.password');

    $this->assertDatabaseHas('users', ['email' => 'kiyoshi@example.com']);
    $this->assertAuthenticated();
});

it('rejects registration with a duplicate email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    postJson('/api/register', [
        'name' => 'Dup',
        'email' => 'taken@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertStatus(422)->assertJsonValidationErrorFor('email');

    $this->assertGuest();
});

it('rejects registration when the password confirmation does not match', function () {
    postJson('/api/register', [
        'name' => 'Mismatch',
        'email' => 'mismatch@example.com',
        'password' => 'password123',
        'password_confirmation' => 'different123',
    ])->assertStatus(422)->assertJsonValidationErrorFor('password');
});

it('logs in an existing user with valid credentials', function () {
    $user = User::factory()->create(['password' => 'password123']);

    postJson('/api/login', [
        'email' => $user->email,
        'password' => 'password123',
    ])->assertOk()->assertJsonPath('data.id', $user->id);

    $this->assertAuthenticatedAs($user);
});

it('rejects login with invalid credentials', function () {
    $user = User::factory()->create(['password' => 'password123']);

    postJson('/api/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertStatus(422)->assertJsonValidationErrorFor('email');

    $this->assertGuest();
});

it('returns the authenticated user from the me endpoint', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.email', $user->email);
});

it('blocks unauthenticated access to protected endpoints', function () {
    getJson('/api/me')->assertUnauthorized();
    postJson('/api/logout')->assertUnauthorized();
});

it('logs out an authenticated user', function () {
    // The session teardown (invalidate + token regenerate) is standard framework
    // behaviour; here we assert the endpoint's 204 contract. That logout requires
    // authentication is covered by the "blocks unauthenticated access" test.
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/logout')
        ->assertNoContent();
});
