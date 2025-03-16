// @ts-check
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightImageZoom from 'starlight-image-zoom';
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
    site: 'https://quacklytics.com',
    base: '/',
    vite: {
        plugins: [
            tailwindcss()
        ],
    },
    integrations: [
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
                        {slug: 'start-here/docker'},
                        {slug: 'start-here/roadmap'},
                    ],
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
                Footer: './src/components/Footer.astro',
            },
        }),
    ],
});
