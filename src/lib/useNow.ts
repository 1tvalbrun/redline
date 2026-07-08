"use client"

import { useState } from "react"

// Timestamp frozen at mount — for relative labels ("2d ago"), not ticking
// clocks. Keeps render pure per the React Compiler.
export const useNow = () => {
  const [now] = useState(() => Date.now())
  return now
}
