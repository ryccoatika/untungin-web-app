import { useState } from "react";

/**
 * A number that changes whenever `state` changes. Key form fields with it so they remount and pick up
 * refilled defaults (React resets uncontrolled forms after an action).
 */
export function useRemountKey(state: unknown): number {
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  if (state !== seen) {
    setSeen(state);
    setKey((current) => current + 1);
  }
  return key;
}
