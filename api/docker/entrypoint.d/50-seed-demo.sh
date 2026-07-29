#!/bin/sh
# デモアカウント（demo@example.com）を投入する。
#
# Render の無料プランには shell が無いため、デプロイ後に手で db:seed を叩けない。
# コンテナ起動のたびに走るが、LearningTreeSeeder は firstOrCreate + 既存プロジェクト
# チェックで冪等なので、2回目以降は何も足さない。
set -e

[ "$SEED_DEMO_DATA" = "true" ] || exit 0

php /var/www/html/artisan db:seed --force --class='Database\Seeders\LearningTreeSeeder'
