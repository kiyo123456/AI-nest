<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // The API key stays server-side and is never exposed to the SPA.
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-haiku-4-5'),
        'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS', 4096),

        /*
         * Chat is the only endpoint that costs money, so it is the only one
         * that is rate limited. The per-minute limit stops a runaway loop or
         * a double click; the per-day limit is what actually caps the bill.
         */
        'rate_limit' => [
            'per_minute' => (int) env('ANTHROPIC_RATE_LIMIT_PER_MINUTE', 1),
            'per_day' => (int) env('ANTHROPIC_RATE_LIMIT_PER_DAY', 50),
        ],
    ],

];
