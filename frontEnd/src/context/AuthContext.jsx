import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { authFetch } from "../config/api";
const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [currentPage, setCurrentPage] = useState("login"),
    [sessionError, setSessionError] = useState("");
  const logout = useCallback(() => {
    sessionStorage.removeItem("organSyncUser");
    localStorage.removeItem("user");
    setUser(null);
    setCurrentPage("login");
  }, []);
  const refreshUser = useCallback(async (token) => {
    const me = await authFetch("/users/me", { token });
    const data = { ...me, userId: me._id, token };
    sessionStorage.setItem("organSyncUser", JSON.stringify(data));
    setUser(data);
    return data;
  }, []);
  useEffect(() => {
    let saved;
    try {
      saved = JSON.parse(sessionStorage.getItem("organSyncUser"));
    } catch {}
    localStorage.removeItem("user");
    if (saved?.token)
      refreshUser(saved.token)
        .catch((error) => {
          logout();
          if (error.status !== 401)
            setSessionError(
              "Unable to restore your session. Please sign in again.",
            );
        })
        .finally(() => setLoading(false));
    else setLoading(false);
    const expired = () => {
      logout();
      setSessionError("Your session expired. Please sign in again.");
    };
    window.addEventListener("organsync:session-expired", expired);
    return () =>
      window.removeEventListener("organsync:session-expired", expired);
  }, [logout, refreshUser]);
  const login = async (email, password) => {
    setSessionError("");
    const data = await authFetch("/users/login", {
      method: "POST",
      body: { email: email.trim(), password },
    });
    const me = await refreshUser(data.token);
    setCurrentPage("dashboard");
    return me;
  };
  const register = async (body) => {
    const result = await authFetch("/users/register", { method: "POST", body });
    setCurrentPage("login");
    return result;
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionError,
        currentPage,
        setCurrentPage,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
