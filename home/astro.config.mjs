// @ts-check
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightImageZoom from 'starlight-image-zoom';
import tailwindcss from "@tailwindcss/vite";

const homePort = Number(process.env.HOME_PORT ?? process.env.PUBLIC_HOME_PORT ?? 3002);

// https://astro.build/config
export default defineConfig({
    site: 'https://quacklytics.com',
    base: '/',
    server: {
        host: '0.0.0.0',
        port: homePort,
    },
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
                Footer: './src/components/footer.astro',
            },
        }),
    ],
});
