/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // MySooq brand tokens (see /DESIGN.md, /brand/tokens.json)
        // Client override: no clay/limewash brown-beige - white surfaces, forest-green accent only.
        primary: '#0B3D24',    // Forest green - actionable accent
        secondary: '#201A16',  // Charcoal - headers, key elements
        background: '#E9EAEB',   // light grey (matches tokens.bg.canvas)
        surface: '#FFFFFF',    // cards/modals (white, so they lift off the grey canvas)
        'surface-muted': '#F2F4F7',
        border: { DEFAULT: '#D5DAE0', strong: '#C0C6CF' },  // visible card/input/divider edges
        text: '#201A16',       // Charcoal
        muted: '#6B7280',      // Neutral gray - muted description text
        error: '#B3432B',
        success: '#3D7A52',
        // Component-compat aliases
        brand: '#0B3D24',
        dark: '#201A16',
        clay: { 900: '#2B1B12', 700: '#5A3D2B', 500: '#8B5E3C' },
        limewash: { 50: '#FFFFFF', 100: '#FAFAFA' },
        forest: { 100: '#EAF3EC', 600: '#0B3D24', 700: '#082A19' },
      }
    },
  },
  plugins: [],
}

