<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Credentialed (cookie) requests forbid a wildcard origin, so the SPA's
    // dev-server origin(s) are listed explicitly via the FRONTEND_URL env.
    'allowed_origins' => explode(',', (string) env('FRONTEND_URL', 'http://localhost:5173')),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // A cross-origin response only hands the SPA the CORS-safelisted headers
    // unless they are named here. Retry-After carries the seconds the chat
    // rate limiter wants the user to wait, which is the difference between
    // "wait a moment" and "wait 43 seconds".
    'exposed_headers' => ['Retry-After'],

    'max_age' => 0,

    'supports_credentials' => true,

];
