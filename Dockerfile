FROM php:8.3-cli-alpine

RUN apk add --no-cache git unzip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
ENV COMPOSER_ALLOW_SUPERUSER=1

# dependências primeiro (aproveita o cache do build)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist

COPY . .
RUN composer dump-autoload --optimize --no-dev \
 && php artisan package:discover --ansi \
 && mkdir -p storage/framework/views storage/framework/cache bootstrap/cache

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    PHP_CLI_SERVER_WORKERS=8

EXPOSE 8080
CMD ["sh", "-c", "php artisan deufome:preparar && php artisan view:cache && cd public && exec php -S 0.0.0.0:${PORT:-8080} ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php"]
