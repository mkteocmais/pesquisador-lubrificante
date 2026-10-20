/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      // Identidade da Evora Lubrificantes (evoralub.com.br): azul Evora como
      // marca, vermelho Evora como destaque (botões de chamada, marcadores) e
      // o grafite #131E25 nos textos. Mesmos nomes de token do Juntto.
      colors: {
        page: "#F4F5F7",
        surface: "#FFFFFF",
        sunken: "#F1F3F5",
        line: "#DEE2E6",
        ink: "#131E25",
        muted: "#6D7A82",
        brand: { DEFAULT: "#003CA6", ink: "#003CA6", dark: "#002971", soft: "#E6EDF8", light: "#9DB5E8" },
        accent: { DEFAULT: "#BA1928", soft: "#FBEAEC" },
      },
      fontFamily: {
        // Roboto no texto, Open Sans extra-negrito nos títulos e Roboto
        // Condensed nos sobretítulos espaçados, como no site.
        sans: ["Roboto", "system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
        titulo: ['"Open Sans"', "Roboto", "sans-serif"],
        condensado: ['"Roboto Condensed"', "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
