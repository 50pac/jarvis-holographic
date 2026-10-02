import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}', '!./node_modules/**', '!./dist/**'],
  theme: {
    extend: {
      colors: {
        ink: { 0: '#0E0D0B', 1: '#17140F', 2: '#221E17' },
        line: { DEFAULT: '#3A342A', hi: '#6E6757' },
        bone: { DEFAULT: '#EDE6D3', 2: '#B9B09B', 3: '#8B826F' },
        signal: '#FF5A1F', amber: '#F2A33A', verdigris: '#4FB39C',
        warn: '#FFC247', danger: '#FF4B3A', oxide: '#C8412F',
      },
      fontFamily: {
        display: ['"Big Shoulders Stencil Display"', '"Microsoft YaHei UI"', '"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans Condensed"', '"Microsoft YaHei UI"', '"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', '"Microsoft YaHei UI"', '"PingFang SC"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      fontSize: { 'step-0': '12px', 'step-1': '14px', 'step-2': '16px', 'step-3': '20px', 'step-4': '28px', 'step-5': '40px', 'step-6': '72px' },
      transitionTimingFunction: { mech: 'cubic-bezier(.2,.8,.2,1)' },
      transitionDuration: { 120: '120ms', 200: '200ms', 360: '360ms' },
    },
  },
  plugins: [plugin(({ addVariant }) => {
    addVariant('hov', '@media (hover: hover) { &:hover }');
    addVariant('reduce', '[data-motion="reduce"] &');
  })],
};
