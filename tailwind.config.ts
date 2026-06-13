import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontFamily: {
      sans: ['"Plus Jakarta Sans"', '"Anek Bangla"', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        shariah: {
          DEFAULT: "hsl(var(--shariah-brand))",
          foreground: "hsl(var(--shariah-brand-foreground))",
          accent: "hsl(var(--shariah-accent))",
          "accent-foreground": "hsl(var(--shariah-accent-foreground))",
          green: {
            50: "hsl(var(--shariah-green-50))",
            100: "hsl(var(--shariah-green-100))",
            300: "hsl(var(--shariah-green-300))",
            600: "hsl(var(--shariah-green-600))",
            800: "hsl(var(--shariah-green-800))",
            900: "hsl(var(--shariah-green-900))",
          },
          gold: {
            100: "hsl(var(--shariah-gold-100))",
            300: "hsl(var(--shariah-gold-300))",
            500: "hsl(var(--shariah-gold-500))",
            700: "hsl(var(--shariah-gold-700))",
            900: "hsl(var(--shariah-gold-900))",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(10px)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "slide-out-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "zoom-in": {
          from: { opacity: "0", transform: "scale(0.9)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "zoom-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.9)" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s cubic-bezier(0.23,1,0.32,1)",
        "fade-out": "fade-out 0.3s cubic-bezier(0.23,1,0.32,1)",
        "scale-in": "scale-in 0.25s cubic-bezier(0.23,1,0.32,1)",
        "scale-out": "scale-out 0.25s cubic-bezier(0.23,1,0.32,1)",
        "slide-up": "slide-up 0.3s cubic-bezier(0.23,1,0.32,1)",
        "slide-down": "slide-down 0.3s cubic-bezier(0.23,1,0.32,1)",
        "slide-in-left": "slide-in-left 0.3s cubic-bezier(0.23,1,0.32,1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.23,1,0.32,1)",
        "slide-out-left": "slide-out-left 0.3s cubic-bezier(0.23,1,0.32,1)",
        "slide-out-right": "slide-out-right 0.3s cubic-bezier(0.23,1,0.32,1)",
        "zoom-in": "zoom-in 0.25s cubic-bezier(0.23,1,0.32,1)",
        "zoom-out": "zoom-out 0.25s cubic-bezier(0.23,1,0.32,1)",
        "float-y": "float-y 3s ease-in-out infinite",
        shake: "shake 0.4s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
