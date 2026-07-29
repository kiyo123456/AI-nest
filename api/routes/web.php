<?php

use Illuminate\Support\Facades\Route;

/*
 * この Laravel は API 専用で、画面は別サービスの SPA（frontend/）が持つ。
 *
 * Laravel 標準の welcome ビューは @vite で resources/js|css のビルド成果物を
 * 参照するが、その雛形はこのプロダクトでは使っていない。本番イメージにも含めて
 * いないため、ビューを返すと ViteException になる。ここでは所在だけを返す。
 */
Route::get('/', fn () => response()->json([
    'service' => config('app.name'),
    'docs' => 'https://github.com/kiyo123456/AI-nest',
]));
