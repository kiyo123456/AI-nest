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
     * Costs two queries regardless of how deep the path is: one recursive CTE
     * for the ancestors, one for their messages. Asking each node for its own
     * messages would be an N+1 that grows with depth — and growing deeper is
     * precisely what this product encourages.
     *
     * @return Collection<int, Message>
     */
    public function build(Node $target): Collection
    {
        $path = $target->ancestorPath()->values();

        // node id => the message its thread is cut at (null = keep it whole).
        // A null branch point (child created without one) means the cutoff is
        // unknown, so we fall back to the full parent thread; the target node
        // has no child on the path and therefore always keeps everything.
        $cutoffs = $path
            ->mapWithKeys(fn (Node $node, int $index): array => [
                $node->getKey() => $path->get($index + 1)?->branch_from_message_id,
            ])
            ->all();

        $messages = $this->fetchMessages($cutoffs);

        return $path->flatMap(
            fn (Node $node): Collection => $messages->get($node->getKey(), collect()),
        );
    }

    /**
     * Fetch every message the context needs in a single query.
     *
     * The per-node cutoffs become one OR group each. Selecting by node alone
     * and trimming in PHP would be shorter, but a long root thread that
     * branched early would ship a lot of rows only to throw them away.
     *
     * @param  array<int, int|null>  $cutoffs
     * @return Collection<int, Collection<int, Message>> keyed by node id
     */
    protected function fetchMessages(array $cutoffs): Collection
    {
        return Message::query()
            ->where(function ($query) use ($cutoffs): void {
                foreach ($cutoffs as $nodeId => $cutoff) {
                    $query->orWhere(function ($thread) use ($nodeId, $cutoff): void {
                        $thread->where('node_id', $nodeId);

                        if ($cutoff !== null) {
                            $thread->where('id', '<=', $cutoff);
                        }
                    });
                }
            })
            // `id` order is what makes this the order the messages were said in.
            ->orderBy('id')
            ->get()
            ->groupBy('node_id');
    }
}
