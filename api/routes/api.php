<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Message\MessageController;
use App\Http\Controllers\Node\NodeChatController;
use App\Http\Controllers\Node\NodeController;
use App\Http\Controllers\Project\ProjectController;
use Illuminate\Support\Facades\Route;

// Guest auth endpoints (session established via the web guard / cookie).
Route::post('/register', [AuthController::class, 'register'])->name('register');
Route::post('/login', [AuthController::class, 'login'])->name('login');

// Authenticated endpoints (SPA cookie session, verified by the sanctum guard).
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me'])->name('me');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    // Learning themes (projects). apiResource omits create/edit (no HTML forms).
    Route::apiResource('projects', ProjectController::class);

    // Nodes (branches) — shallow nest: create/list under the project,
    // single-item show/update/destroy are flat at /nodes/{node}.
    Route::apiResource('projects.nodes', NodeController::class)->shallow();

    // Node ancestry: breadcrumb path (root→node) and assembled AI context.
    Route::get('nodes/{node}/path', [NodeController::class, 'path'])->name('nodes.path');
    Route::get('nodes/{node}/context', [NodeController::class, 'context'])->name('nodes.context');

    // Ask the AI within a node's thread (stores both the question and the reply).
    // The only endpoint that costs money, hence the only one that is throttled
    // (see AppServiceProvider::configureAiChatRateLimit).
    Route::post('nodes/{node}/chat', NodeChatController::class)
        ->middleware('throttle:ai-chat')
        ->name('nodes.chat');

    // Messages — appended to / listed from a node's thread.
    Route::apiResource('nodes.messages', MessageController::class)
        ->shallow()
        ->only(['index', 'store']);
});
