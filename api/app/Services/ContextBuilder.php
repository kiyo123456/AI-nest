<?php

namespace App\Services;

use App\Models\Message;
use App\Models\Node;
use Illuminate\Support\Collection;

class ContextBuilder
{
    /**
     * Assemble the conversation context to send to the AI for a target node.
     *
     * Walks the ancestor path root → target and, for every node, keeps its
     * messages only up to the point where the *next* node on the path branched
     * off (its child's `branch_from_message_id`). The target node keeps all of
     * its messages. Concatenated root-first, this reconstructs "the road taken"
     * without any post-branch / off-topic messages.
     *
     * @return Collection<int, Message>
     */
    public function build(Node $target): Collection
    {
        $path = $target->ancestorPath()->values();

        return $path->flatMap(function (Node $node, int $index) use ($path): Collection {
            $child = $path->get($index + 1);
            $query = $node->messages()->orderBy('id');

            // Cut the parent thread at the message the child branched from.
            // A null branch point (child created without one) means the cutoff
            // is unknown, so we fall back to the full parent thread.
            if ($child !== null && $child->branch_from_message_id !== null) {
                $query->where('id', '<=', $child->branch_from_message_id);
            }

            return $query->get();
        });
    }
}
