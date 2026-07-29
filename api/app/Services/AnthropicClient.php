<?php

namespace App\Services;

use Anthropic\Client as AnthropicSdkClient;
use Anthropic\Core\Exceptions\APIException;
use App\Exceptions\AiRequestException;
use App\Models\Message;
use Illuminate\Support\Collection;
use Throwable;

/**
 * The application's boundary to the AI provider.
 *
 * Everything provider-specific lives here, so swapping the SDK for raw HTTP
 * (or another provider) touches this class and its test only.
 */
class AnthropicClient
{
    /**
     * Framing for the assistant. Kept short so the reconstructed conversation
     * — not the prompt — dominates the context.
     */
    private const SYSTEM_PROMPT = <<<'TEXT'
        あなたはプログラミング学習者を支える対話型の学習アシスタントです。
        相手が今どこを学んでいるかを踏まえ、簡潔で具体的に答えてください。
        必要なら短い例を添え、前提知識が不足していそうな箇所は補ってください。
        回答は Markdown で構造化してください。見出し・箇条書き・表・（言語名つきの）コードブロックを、内容量に見合う範囲で使ってください。短い答えを無理に飾る必要はありません。
        TEXT;

    public function __construct(private readonly AnthropicSdkClient $client) {}

    /**
     * Send the assembled conversation context and return the reply text.
     *
     * @param  Collection<int, Message>  $context  Messages from the root down, in order.
     *
     * @throws AiRequestException
     */
    public function chat(Collection $context): string
    {
        $messages = $context
            ->map(fn (Message $message): array => [
                'role' => $message->role,
                'content' => $message->content,
            ])
            ->values()
            ->all();

        try {
            $response = $this->client->messages->create(
                maxTokens: (int) config('services.anthropic.max_tokens'),
                messages: $messages,
                model: (string) config('services.anthropic.model'),
                system: self::SYSTEM_PROMPT,
            );
        } catch (APIException $e) {
            // Wrap without echoing the provider payload, which can include
            // request details we don't want in logs or responses.
            throw new AiRequestException('The AI provider returned an error.', previous: $e);
        } catch (Throwable $e) {
            throw new AiRequestException('The AI provider could not be reached.', previous: $e);
        }

        if ($response->stopReason === 'refusal') {
            throw new AiRequestException('The AI declined to answer this request.');
        }

        $text = collect($response->content)
            ->filter(fn (object $block): bool => $block->type === 'text')
            ->map(fn (object $block): string => $block->text)
            ->implode('');

        if (trim($text) === '') {
            throw new AiRequestException('The AI returned an empty response.');
        }

        return $text;
    }
}
