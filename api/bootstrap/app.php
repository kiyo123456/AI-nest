<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // In production TLS terminates at Render's load balancer, so the app
        // itself only ever sees plain HTTP. Without trusting the forwarding
        // headers, `$request->secure()` is false and Laravel issues http:// URLs
        // and drops the Secure flag on cookies.
        $middleware->trustProxies(at: '*');

        // SPA cookie auth: requests from SANCTUM_STATEFUL_DOMAINS carry the
        // session cookie + CSRF token, so they authenticate via the web guard.
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
