<?php

namespace App\Providers;

use Anthropic\Client as AnthropicSdkClient;
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
        //
    }
}
