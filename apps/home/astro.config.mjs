// @ts-check
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightImageZoom from 'starlight-image-zoom';
import tailwindcss from "@tailwindcss/vite";

const homePort = Number(process.env.HOME_PORT ?? process.env.PUBLIC_HOME_PORT ?? 3002);

function quacklyticsHomepageTracking() {
    return {
        name: 'quacklytics-homepage-tracking',
        hooks: {
            'astro:config:setup': ({injectScript}) => {
                injectScript('page', 'import "/src/quacklytics-analytics.ts";');
            },
        },
    };
}

// https://astro.build/config
export default defineConfig({
    site: 'https://quacklytics.com',
    base: '/',
    redirects: {
        '/start-here/docker': '/start-here/local/',
    },
    server: {
        host: '0.0.0.0',
        port: homePort,
    },
    vite: {
        plugins: [
            tailwindcss()
        ],
        // The injected tracker is a linked workspace package, so Vite's startup scan misses
        // its dependencies and would otherwise reload the first page after discovering them.
        optimizeDeps: {
            include: [
                '@quacklytics/client > preact',
                '@quacklytics/client > preact/jsx-runtime',
                '@quacklytics/client > zod',
            ],
        },
    },
    integrations: [
        quacklyticsHomepageTracking(),
        starlight({
            title: 'Quacklytics',
            customCss: [
                './src/styles/main.css',
            ],
            plugins: [
                starlightImageZoom(),
            ],
            social: {
                github: 'https://github.com/xz3dev/quacklytics/',
            },
            sidebar: [
                {
                    label: 'Start Here',
                    items: [
                        {slug: 'start-here/introduction'},
                        {slug: 'start-here/local'},
                        {slug: 'start-here/production'},
                    ],
                },
                {
                    label: 'Self-Hosting',
                    autogenerate: {directory: 'self-hosting'},
                },
                {
                    label: 'Guides',
                    items: [
                        {slug: 'guides/send-data'},
                        {slug: 'guides/import'},
                    ],
                },
                {
                    label: 'Reference',
                    autogenerate: {directory: 'reference'},
                },
            ],
            components: {
                Footer: './src/components/footer.astro',
            },
        }),
    ],
});
