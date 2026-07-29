# 本番用イメージ。Render は PHP のネイティブランタイムを持たないため Docker で動かす。
#
# 土台の serversideup/php は nginx + php-fpm + Laravel 向けの起動処理を同梱していて、
# pdo_pgsql / opcache も入っている。自前で nginx と supervisor を組むより
# 保守する設定ファイルが減る。

# --- vendor 層 ---------------------------------------------------------------
# composer.json/lock だけを先に COPY することで、アプリのコードを触っただけの
# ビルドでは composer install がキャッシュヒットする。
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction
COPY . .
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative

# --- 実行イメージ -------------------------------------------------------------
FROM serversideup/php:8.4-fpm-nginx

# コンテナ起動時に migrate と各種キャッシュ生成を行う。
# config:cache をビルド時に走らせるとビルド時の（空の）env が焼き込まれてしまうので、
# 実行時の env が揃っている起動時に回すのが必須。
ENV AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_MIGRATION=true \
    AUTORUN_LARAVEL_CONFIG_CACHE=true \
    AUTORUN_LARAVEL_ROUTE_CACHE=true \
    AUTORUN_LARAVEL_VIEW_CACHE=true \
    AUTORUN_LARAVEL_STORAGE_LINK=false \
    PHP_OPCACHE_ENABLE=1

USER root
COPY --from=vendor --chown=www-data:www-data /app /var/www/html
# イメージは /etc/entrypoint.d/* を起動時に実行する。デモデータ投入はここに置く。
COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/
USER www-data

# nginx は 8080 で待ち受ける（非 root 実行のため 80 は使えない）。
# Render 側には env の PORT=8080 でルーティング先を伝える。
EXPOSE 8080
