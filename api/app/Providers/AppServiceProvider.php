<?php

namespace App\Providers;

use Anthropic\Client as AnthropicSdkClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The SDK client reads the key from config so tests can swap it out
        // and the key never has to be constructed at the call site.
        $this->app->singleton(
            AnthropicSdkClient::class,
            fn (): AnthropicSdkClient => new AnthropicSdkClient(
                apiKey: (string) config('services.anthropic.key'),
            ),
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureAiChatRateLimit();
    }

    /**
     * Cap how often a user may reach the AI.
     *
     * Every other endpoint only touches the local database and costs nothing;
     * this one leaves for the provider and is billed per token. Two windows:
     * the per-minute limit stops a double click or a runaway loop right away,
     * and the per-day limit is what actually bounds the bill.
     *
     * Keyed by user rather than IP so that people behind the same connection
     * do not consume each other's allowance. `config()` is read inside the
     * closure, so the limits are evaluated per request and tests can lower
     * them instead of sending hundreds of requests.
     *
     * The two windows must carry *different* `by()` values: the throttle
     * middleware derives its cache key from the limiter name plus this key,
     * so two limits sharing one key would count into the same bucket.
     */
    protected function configureAiChatRateLimit(): void
    {
        RateLimiter::for('ai-chat', function (Request $request): array {
            // `auth:sanctum` rejects guests before this runs; the IP fallback
            // is only there so the limiter can never fail on a null user.
            $key = $request->user()?->getAuthIdentifier() ?: $request->ip();

            return [
                Limit::perMinute((int) config('services.anthropic.rate_limit.per_minute'))
                    ->by("minute:{$key}"),
                Limit::perDay((int) config('services.anthropic.rate_limit.per_day'))
                    ->by("day:{$key}"),
            ];
        });
    }
}
