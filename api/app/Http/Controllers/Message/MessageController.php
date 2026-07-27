<?php

namespace App\Http\Controllers\Message;

use App\Http\Controllers\Controller;
use App\Http\Requests\Message\StoreMessageRequest;
use App\Http\Resources\MessageResource;
use App\Models\Node;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class MessageController extends Controller
{
    /**
     * List the messages in a node's conversation thread (owner only).
     */
    public function index(Node $node): AnonymousResourceCollection
    {
        $this->authorize('view', $node);

        return MessageResource::collection($node->messages()->get());
    }

    /**
     * Append a message to a node's thread.
     */
    public function store(StoreMessageRequest $request, Node $node): JsonResponse
    {
        $this->authorize('update', $node);

        $message = $node->messages()->create($request->validated());

        return MessageResource::make($message)
            ->response()
            ->setStatusCode(HttpResponse::HTTP_CREATED);
    }
}
