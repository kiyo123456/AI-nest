<?php

namespace App\Models;

use Database\Factories\NodeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

#[Fillable(['project_id', 'parent_id', 'branch_from_message_id', 'summary'])]
class Node extends Model
{
    /** @use HasFactory<NodeFactory> */
    use HasFactory;

    /**
     * The project this node belongs to.
     *
     * @return BelongsTo<Project, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * The parent node this node branched from (null for the root node).
     *
     * @return BelongsTo<Node, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Node::class, 'parent_id');
    }

    /**
     * Child nodes that branched off this node.
     *
     * @return HasMany<Node, $this>
     */
    public function children(): HasMany
    {
        return $this->hasMany(Node::class, 'parent_id');
    }

    /**
     * Messages exchanged within this node's conversation thread.
     *
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * The exact parent message this node branched off from.
     * Identifies the split point so the parent's context can be assembled
     * up to (and including) this message.
     *
     * @return BelongsTo<Message, $this>
     */
    public function branchFromMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'branch_from_message_id');
    }

    /**
     * The ancestor chain from the root down to (and including) this node.
     *
     * Walks `parent_id` up to the root in a single recursive-CTE query
     * (standard SQL; works on MySQL 8 and SQLite). The result is ordered
     * root-first so it can drive both the AI context and the breadcrumb.
     *
     * @return Collection<int, Node>
     */
    public function ancestorPath(): Collection
    {
        $sql = <<<'SQL'
            WITH RECURSIVE ancestors AS (
                SELECT *, 0 AS depth FROM nodes WHERE id = ?
                UNION ALL
                SELECT nodes.*, ancestors.depth + 1
                FROM nodes
                INNER JOIN ancestors ON nodes.id = ancestors.parent_id
            )
            SELECT id, project_id, parent_id, branch_from_message_id, summary, created_at, updated_at
            FROM ancestors
            ORDER BY depth DESC
        SQL;

        return static::hydrate(DB::select($sql, [$this->getKey()]));
    }
}
