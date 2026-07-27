<?php

namespace App\Policies;

use App\Models\Node;
use App\Models\User;

class NodePolicy
{
    /**
     * Determine whether the user may view the node.
     */
    public function view(User $user, Node $node): bool
    {
        return $this->owns($user, $node);
    }

    /**
     * Determine whether the user may update the node
     * (also gates adding messages to the node's thread).
     */
    public function update(User $user, Node $node): bool
    {
        return $this->owns($user, $node);
    }

    /**
     * Determine whether the user may delete the node.
     */
    public function delete(User $user, Node $node): bool
    {
        return $this->owns($user, $node);
    }

    /**
     * Ownership is derived from the node's project: node → project → user.
     */
    protected function owns(User $user, Node $node): bool
    {
        return $user->id === $node->project->user_id;
    }
}
