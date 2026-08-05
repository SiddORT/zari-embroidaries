import {
  createContext,
  useContext,
  ReactNode,
} from "react";

export interface FormAccess {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canDownload: boolean;
}

const FormAccessContext = createContext<FormAccess>({
  canView: false,
  canEdit: false,
  canDelete: false,
  canDownload: false,
});

export function FormAccessProvider({
  access,
  children,
}: {
  access: FormAccess;
  children: ReactNode;
}) {
  return (
    <FormAccessContext.Provider value={access}>
      {children}
    </FormAccessContext.Provider>
  );
}

export function useFormAccessContext() {
  return useContext(FormAccessContext);
}