<?php

namespace App\Http\Requests\Message;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreMessageRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Ownership of the parent node is enforced by NodePolicy in the controller.
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        // `role` is a plain string column validated at the app layer (no DB enum).
        // Same cap as ChatRequest — see the note there on the TEXT byte limit.
        return [
            'role' => ['required', 'in:user,assistant'],
            'content' => ['required', 'string', 'max:10000'],
        ];
    }

    /**
     * Same wording as ChatRequest: both end up in front of the user.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'content.required' => '本文を入力してください。',
            'content.max' => '本文が長すぎます（:max 文字まで）。',
        ];
    }
}
