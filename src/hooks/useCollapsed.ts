import { useState } from "react";

// A collapsed/expanded flag remembered per browser under `collapse:<id>`.
// Storage may be blocked (private mode); then it just isn't remembered.
export function useCollapsed(id: string, initial = false): [boolean, () => void] {
  const key = `collapse:${id}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === "1";
    } catch {
      return initial;
    }
  });
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(key, c ? "0" : "1");
      } catch {
        /* storage blocked */
      }
      return !c;
    });
  }
  return [collapsed, toggle];
}
