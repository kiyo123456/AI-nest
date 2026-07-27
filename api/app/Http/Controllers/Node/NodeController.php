<?php

namespace App\Http\Controllers\Node;

use App\Http\Controllers\Controller;
use App\Http\Requests\Node\StoreNodeRequest;
use App\Http\Requests\Node\UpdateNodeRequest;
use App\Http\Resources\MessageResource;
use App\Http\Resources\NodeResource;
use App\Models\Node;
use App\Models\Project;
use App\Services\ContextBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class NodeController extends Controller
{
    /**
     * List all nodes (branches) of a project the user owns.
     */
    public function index(Project $project): AnonymousResourceCollection
    {
        $this->authorize('view', $project);

        $nodes = $project->nodes()
            ->withCount(['children', 'messages'])
            ->get();

        return NodeResource::collection($nodes);
    }

    /**
     * Create a new node (branch) within the project.
     */
    public function store(StoreNodeRequest $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $node = $project->nodes()->create($request->validated());

        return NodeResource::make($node)
            ->response()
            ->setStatusCode(HttpResponse::HTTP_CREATED);
    }

    /**
     * Show a single node (owner only; others get 403).
     */
    public function show(Node $node): NodeResource
    {
        $this->authorize('view', $node);

        return NodeResource::make($node->loadCount(['children', 'messages']));
    }

    /**
     * Update a node's summary.
     */
    public function update(UpdateNodeRequest $request, Node $node): NodeResource
    {
        $this->authorize('update', $node);

        $node->update($request->validated());

        return NodeResource::make($node);
    }

    /**
     * Return the ancestor path root → node (drives breadcrumbs).
     */
    public function path(Node $node): AnonymousResourceCollection
    {
        $this->authorize('view', $node);

        return NodeResource::collection($node->ancestorPath());
    }

    /**
     * Return the assembled AI conversation context for the node
     * (messages from the root down, cut at each branch point).
     */
    public function context(Node $node, ContextBuilder $contextBuilder): AnonymousResourceCollection
    {
        $this->authorize('view', $node);

        return MessageResource::collection($contextBuilder->build($node));
    }

    /**
     * Delete a leaf node. Nodes with children are refused (409) so a branch's
     * learning history is never removed by plucking out a middle node.
     */
    public function destroy(Node $node): Response
    {
        $this->authorize('delete', $node);

        if ($node->children()->exists()) {
            abort(HttpResponse::HTTP_CONFLICT, 'Cannot delete a node that has child branches.');
        }

        $node->delete();

        return response()->noContent();
    }
}
