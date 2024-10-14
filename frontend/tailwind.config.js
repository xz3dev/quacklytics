import {addDynamicIconSelectors, addIconSelectors} from '@iconify/tailwind'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
    addDynamicIconSelectors(),
    addIconSelectors({
      prefixes: ['tabler']
    }),
  ],
}

