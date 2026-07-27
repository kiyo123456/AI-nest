<?php

namespace App\Http\Resources;

use App\Models\Node;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Node
 */
class NodeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'parent_id' => $this->parent_id,
            'branch_from_message_id' => $this->branch_from_message_id,
            'summary' => $this->summary,
            // Present only when the controller loaded the counts. children_count
            // lets the client tell leaf nodes (deletable) from branch nodes.
            'children_count' => $this->whenCounted('children'),
            'messages_count' => $this->whenCounted('messages'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
