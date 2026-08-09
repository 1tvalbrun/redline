"use client"

import { useTheme } from "next-themes"

// Clerk derives hover/focus shades from these, so it needs concrete colors,
// not var() references — mirror the primitives in globals.css. resolvedTheme
// is undefined on the server and first client render, so both fall back to
// light and the dark values apply after hydration.
const LIGHT = {
  colorPrimary: "#0e5fd8",
  colorBackground: "#ffffff",
  colorText: "#151a21",
  colorTextSecondary: "#4e5866",
  colorInputBackground: "#f7f8fa",
  colorInputText: "#151a21",
  colorDanger: "#c93a26",
  borderRadius: "0.625rem",
  fontFamily: "var(--font-instrument), sans-serif",
}

const DARK = {
  ...LIGHT,
  colorPrimary: "#7fb0f9",
  colorBackground: "#171c22",
  colorText: "#e7eaee",
  colorTextSecondary: "#a5adb8",
  colorInputBackground: "#101418",
  colorInputText: "#e7eaee",
  colorDanger: "#e05540",
}

export const useClerkAppearance = () => {
  const { resolvedTheme } = useTheme()
  return { variables: resolvedTheme === "dark" ? DARK : LIGHT }
}
