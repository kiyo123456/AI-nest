<?php

namespace App\Http\Controllers\Node;

use App\Http\Controllers\Controller;
use App\Http\Requests\Node\ChatRequest;
use App\Http\Resources\MessageResource;
use App\Models\Node;
use App\Services\AnthropicClient;
use App\Services\ContextBuilder;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class NodeChatController extends Controller
{
    /**
     * Ask the AI within a node's thread.
     *
     * Persists the user's turn, rebuilds the conversation context along the
     * ancestor path, sends it to the AI, and stores the reply.
     *
     * If the AI call fails the user's message is deliberately kept: losing
     * learning history would contradict the product's core value, and the
     * user can simply retry from where they left off.
     */
    public function __invoke(
        ChatRequest $request,
        Node $node,
        ContextBuilder $contextBuilder,
        AnthropicClient $ai,
    ): JsonResponse {
        $this->authorize('update', $node);

        $userMessage = $node->messages()->create([
            'role' => 'user',
            'content' => $request->validated('content'),
        ]);

        // Built after saving, so the turn just posted is part of the context.
        $reply = $ai->chat($contextBuilder->build($node));

        $assistantMessage = $node->messages()->create([
            'role' => 'assistant',
            'content' => $reply,
        ]);

        return MessageResource::collection([$userMessage, $assistantMessage])
            ->response()
            ->setStatusCode(HttpResponse::HTTP_CREATED);
    }
}
