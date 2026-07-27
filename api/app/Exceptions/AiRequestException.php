<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Raised when the upstream AI provider fails or declines to answer.
 *
 * Never carries the API key or raw provider payload — only a safe summary.
 */
class AiRequestException extends Exception
{
    /**
     * Render as 502: the failure is upstream, not in this API.
     */
    public function render(Request $request): JsonResponse
    {
        return response()->json(
            ['message' => $this->getMessage() ?: 'The AI provider could not be reached.'],
            HttpResponse::HTTP_BAD_GATEWAY,
        );
    }
}
