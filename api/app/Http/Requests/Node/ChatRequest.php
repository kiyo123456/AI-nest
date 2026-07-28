<?php

namespace App\Http\Requests\Node;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ChatRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Ownership of the node is enforced by NodePolicy in the controller.
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        // `role` is not accepted: a chat turn is always from the user.
        // The cap keeps `messages.content` (a MySQL TEXT column, 65,535 bytes)
        // out of reach: 10,000 Japanese characters is ~30,000 bytes.
        return [
            'content' => ['required', 'string', 'max:10000'],
        ];
    }

    /**
     * The app speaks Japanese, and these two reach the user directly in the
     * chat panel, so they are worth spelling out rather than shipping
     * Laravel's English defaults.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'content.required' => '質問を入力してください。',
            'content.max' => '質問が長すぎます（:max 文字まで）。',
        ];
    }
}
