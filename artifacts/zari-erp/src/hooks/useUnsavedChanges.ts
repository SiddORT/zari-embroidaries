import { useEffect, useRef } from "react";
import { useNavigationGuardContext } from "@/contexts/NavigationGuardContext";

/**
 * Registers a dirty-state guard for the current page.
 * - Shows a custom 3-button modal when the user tries to navigate away in-app.
 * - Attaches a native beforeunload dialog for browser refresh / tab close.
 *
 * @param isDirty  Whether the form has unsaved changes.
 * @param onSave   Async function that saves the form. Called by "Save and Exit".
 */
export function useUnsavedChanges(isDirty: boolean, onSave: () => Promise<void>) {
  const { register, unregister, setDirty } = useNavigationGuardContext();

  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    register(() => onSaveRef.current());
    return () => unregister();
  }, [register, unregister]);

  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
