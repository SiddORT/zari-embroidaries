import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { AlertTriangle, Save, LogOut, Loader2 } from "lucide-react";

interface NavigationGuardContextValue {
  register: (onSave: () => Promise<void>) => void;
  unregister: () => void;
  setDirty: (dirty: boolean) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue>({
  register: () => {},
  unregister: () => {},
  setDirty: () => {},
});

export function useNavigationGuardContext() {
  return useContext(NavigationGuardContext);
}

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirtyRef = useRef(false);
  const onSaveRef = useRef<(() => Promise<void>) | null>(null);
  const pendingNavRef = useRef<(() => void) | null>(null);
  /** Set to true while executing save so internal navigation in handleSave is not intercepted */
  const savingRef = useRef(false);
  /** Set to true during synthetic navigation (restore / confirm) to avoid re-interception */
  const bypassRef = useRef(false);
  const currentHrefRef = useRef(window.location.href);

  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);

    window.history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
      if (isDirtyRef.current && !bypassRef.current && !savingRef.current) {
        // Build the pending navigation function and show the guard modal
        pendingNavRef.current = () => {
          bypassRef.current = true;
          originalPushState(state, title, url);
          currentHrefRef.current = window.location.href;
          // Dispatch popstate so wouter picks up the new location
          window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
          bypassRef.current = false;
        };
        setShowModal(true);
        // Return WITHOUT changing the URL — wouter will still fire popstate below,
        // but handlePopState will detect the URL hasn't changed and skip it.
        return;
      }
      originalPushState(state, title, url);
      currentHrefRef.current = window.location.href;
    };

    const handlePopState = () => {
      if (bypassRef.current) {
        // Synthetic event we fired ourselves — just update tracked href
        currentHrefRef.current = window.location.href;
        return;
      }

      // Wouter fires a fake popstate right after calling pushState (even when
      // we returned early without changing the URL). Skip those — the URL
      // will still equal currentHrefRef.current in that case.
      if (window.location.href === currentHrefRef.current) {
        return;
      }

      if (isDirtyRef.current) {
        // Real browser back/forward navigation while dirty → restore current page
        const backDestination = window.location.href;

        bypassRef.current = true;
        originalPushState(null, "", currentHrefRef.current);
        // Let wouter know the URL is back where we were
        window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
        bypassRef.current = false;

        pendingNavRef.current = () => {
          bypassRef.current = true;
          originalPushState(null, "", backDestination);
          window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
          currentHrefRef.current = backDestination;
          bypassRef.current = false;
        };

        setShowModal(true);
      } else {
        currentHrefRef.current = window.location.href;
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.history.pushState = originalPushState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const register = useCallback((onSave: () => Promise<void>) => {
    onSaveRef.current = onSave;
  }, []);

  const unregister = useCallback(() => {
    onSaveRef.current = null;
    isDirtyRef.current = false;
  }, []);

  const setDirty = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  async function handleSaveAndExit() {
    const hrefBeforeSave = window.location.href;
    setIsSaving(true);
    savingRef.current = true;
    try {
      if (onSaveRef.current) await onSaveRef.current();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
    isDirtyRef.current = false;
    setShowModal(false);
    // If the page's handleSave already navigated internally (e.g. VendorForm → /masters/vendors),
    // do not execute the original pendingNav — user is already somewhere new.
    if (window.location.href !== hrefBeforeSave) {
      pendingNavRef.current = null;
      return;
    }
    if (pendingNavRef.current) {
      const nav = pendingNavRef.current;
      pendingNavRef.current = null;
      nav();
    }
  }

  function handleExitWithoutSaving() {
    isDirtyRef.current = false;
    setShowModal(false);
    if (pendingNavRef.current) {
      const nav = pendingNavRef.current;
      pendingNavRef.current = null;
      nav();
    }
  }

  function handleCancel() {
    pendingNavRef.current = null;
    setShowModal(false);
  }

  return (
    <NavigationGuardContext.Provider value={{ register, unregister, setDirty }}>
      {children}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Unsaved Changes</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Do you want to save your changes before leaving this page?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { void handleSaveAndExit(); }}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-[#C9B45C] text-sm font-semibold hover:bg-black transition-colors disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save and Exit
              </button>
              <button
                onClick={handleExitWithoutSaving}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Exit Without Saving
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel (Stay on Page)
              </button>
            </div>
          </div>
        </div>
      )}
    </NavigationGuardContext.Provider>
  );
}
