import { useEffect, useState } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export const TOKEN_KEY = "zarierp_token";

export function useAuthToken() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    // Configure the API client to use this token automatically
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  }, []);

  const saveToken = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const clearToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return { token, saveToken, clearToken };
}
