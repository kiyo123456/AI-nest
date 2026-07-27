<?php

namespace App\Http\Requests\Node;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreNodeRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Ownership of the parent project is enforced by ProjectPolicy in the controller.
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $projectId = $this->route('project')->id;

        return [
            'summary' => ['nullable', 'string', 'max:255'],
            // The parent must be another node within the same project.
            'parent_id' => [
                'nullable',
                Rule::exists('nodes', 'id')->where('project_id', $projectId),
            ],
            // The split point must be a message inside the parent node's thread.
            // With no parent_id the where-clause matches nothing, so a branch
            // point cannot be set on a root node.
            'branch_from_message_id' => [
                'nullable',
                Rule::exists('messages', 'id')->where('node_id', $this->input('parent_id')),
            ],
        ];
    }
}
