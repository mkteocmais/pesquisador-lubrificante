/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      // Mesmos tokens do Juntto, com as cores do Pesquisador: azul-marinho
      // (#002B5C) como marca e o vermelho (#E30613) só como destaque.
      colors: {
        page: "#F3F4F8",
        surface: "#FDFDFE",
        sunken: "#F3F4F8",
        line: "#E4E6EE",
        ink: "#101828",
        muted: "#667085",
        brand: { DEFAULT: "#002B5C", ink: "#002B5C", soft: "#E8EEF6", light: "#8FB3E0" },
        accent: { DEFAULT: "#E30613", soft: "#FDECEE" },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
