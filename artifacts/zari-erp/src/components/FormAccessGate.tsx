import { createContext, useContext, ReactNode } from "react";

const ReadOnlyContext = createContext(false);
export const useReadOnly = () => useContext(ReadOnlyContext);

export function FormAccessGate({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return (
    <ReadOnlyContext.Provider value={readOnly}>
      <fieldset disabled={readOnly} className="contents border-0 p-0 m-0 min-w-0">
        {children}
      </fieldset>
    </ReadOnlyContext.Provider>
  );
}