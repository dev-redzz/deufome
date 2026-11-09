FROM php:8.3-cli-alpine

RUN { \
      echo 'expose_php=Off'; \
      echo 'display_errors=Off'; \
      echo 'log_errors=On'; \
      echo 'error_log=/dev/stderr'; \
      echo 'memory_limit=128M'; \
      echo 'upload_max_filesize=6M'; \
      echo 'post_max_size=8M'; \
      echo 'max_execution_time=30'; \
      echo 'date.timezone=UTC'; \
      echo 'opcache.enable_cli=1'; \
    } > /usr/local/etc/php/conf.d/deufome.ini \
 && docker-php-ext-enable opcache || true

WORKDIR /app
COPY . /app
RUN rm -rf /app/data && mkdir -p /data

ENV DATA_DIR=/data \
    PHP_CLI_SERVER_WORKERS=8

EXPOSE 8080
CMD ["sh", "-c", "exec php -S 0.0.0.0:${PORT:-8080} -t public app/router.php"]
