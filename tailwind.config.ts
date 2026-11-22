import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        udhaar: { green: "#15803d", red: "#b91c1c", amber: "#b45309" },
      },
    },
  },
  plugins: [],
};

export default config;
