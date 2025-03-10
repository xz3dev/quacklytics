// @ts-check
import {defineConfig} from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    integrations: [
        starlight({
            title: 'Quacklytics Docs',
            social: {
                github: 'https://github.com/xz3dev/quacklytics/',
            },
            sidebar: [
                {
                    label: 'Start Here',
                    items: [
                        {slug: 'start-here/introduction'},
                        {slug: 'start-here/docker'},
                    ],
                },
                {
                    label: 'Guides',
                    items: [
                        // Each item here is one entry in the navigation menu.
                        {slug: 'guides/import'},
                    ],
                },
                {
                    label: 'Reference',
                    autogenerate: {directory: 'reference'},
                },
            ],
        }),
    ],
});
