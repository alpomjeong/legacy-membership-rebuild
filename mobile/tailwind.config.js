/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        celadon: { DEFAULT: "#2f7d6b", dark: "#4cae95", soft: "#e4efe9", deep: "#235c4f" },
        vermilion: { DEFAULT: "#b23a26", soft: "#f3ddd6" },
        gold: "#b8923f",
        hanji: { DEFAULT: "#f6f1e7", card: "#fffdf8", dark: "#16140f", cardDark: "#221e16" },
        ink: { DEFAULT: "#2a241c", soft: "#6f675a", dark: "#ece6d8", softDark: "#a39a88" },
        line: { DEFAULT: "#e8e0cf", dark: "#332d22" },
      },
      fontFamily: {
        display: ["NanumMyeongjo_800ExtraBold"],
        displayb: ["NanumMyeongjo_700Bold"],
        body: ["NotoSansKR_400Regular"],
        bodym: ["NotoSansKR_500Medium"],
        bodyb: ["NotoSansKR_700Bold"],
      },
    },
  },
  plugins: [],
};
