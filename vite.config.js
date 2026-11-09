import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/admin.js', 'resources/js/tablet.js', 'resources/js/cozinha.js'],
            refresh: true,
        }),
        tailwindcss(),
    ],
    build: {
        target: ['chrome80', 'safari13'],
    },
});
