import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102a43",
        saffron: "#f5a623",
        police: "#163b65",
      },
      boxShadow: {
        panel: "0 18px 50px rgba(15, 35, 60, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
