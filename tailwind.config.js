/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 4s linear infinite',
        'loading-progress': 'progress 2s ease-in-out infinite',
      },
      keyframes: {
        progress: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
      colors: {
        green: {
            50: "#f2faf5",
            100: "#e6f5ec",
            600: "#038c4c",
            700: "#02793f",
            800: "#015d32",
            900: "#013920",
          },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      backgroundImage: {
        'home-hero-section': "url('/images/hero-background.webp')",
        'logo-carbon-nigrani': "url('/images/logo.webp')",
      },
    },
  },
  plugins: [
    function({addUtilities}){
        const newUtilities ={
          ".no-scrollbar ::-webkit-scrollbar":{
            display: "none",
          },
          ".no-scrollbar":{
            "-ms-overflow-style":"none",
            "scrollbar-width":"none",
          },
        };
        addUtilities(newUtilities);
      },
  ],
};
