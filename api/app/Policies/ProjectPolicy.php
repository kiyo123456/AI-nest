<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    /**
     * Any authenticated user may list projects; the query itself is scoped
     * to the current user, so this only gates access to the endpoint.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user owns (and may view) the project.
     */
    public function view(User $user, Project $project): bool
    {
        return $this->owns($user, $project);
    }

    /**
     * Any authenticated user may create their own projects.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user owns (and may update) the project.
     */
    public function update(User $user, Project $project): bool
    {
        return $this->owns($user, $project);
    }

    /**
     * Determine whether the user owns (and may delete) the project.
     */
    public function delete(User $user, Project $project): bool
    {
        return $this->owns($user, $project);
    }

    /**
     * A project is owned when its user_id matches the acting user.
     */
    protected function owns(User $user, Project $project): bool
    {
        return $user->id === $project->user_id;
    }
}
