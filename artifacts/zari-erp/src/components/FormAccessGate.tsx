import { createContext, useContext, ReactNode } from "react";

const ReadOnlyContext = createContext(false);
export const useReadOnly = () => useContext(ReadOnlyContext);

export function FormAccessGate({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return (
      <fieldset disabled={readOnly} className="contents flex flex-col gap-4">
        {children}
      </fieldset>
  );
}