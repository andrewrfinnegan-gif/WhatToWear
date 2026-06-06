/**
 * Auth state: holds the signed-in user + token, persists them to secure storage,
 * and keeps the API client's token in sync. The app works signed-out (guest,
 * local-only); signing in unlocks cloud sync and the AI stylist.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { fetchMe, login as apiLogin, signup as apiSignup, type AuthUser } from '@/api/auth';
import { ApiError, setAuthToken } from '@/api/client';
import { isApiConfigured } from '@/config';
import { deleteSecure, getSecure, setSecure } from '@/utils/secureStorage';

const TOKEN_KEY = 'whattowear/token';
const USER_KEY = 'whattowear/user';

type Status = 'loading' | 'authed' | 'guest';

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const applySession = useCallback(async (token: string, nextUser: AuthUser) => {
    setAuthToken(token);
    setUser(nextUser);
    setStatus('authed');
    await Promise.all([setSecure(TOKEN_KEY, token), setSecure(USER_KEY, JSON.stringify(nextUser))]);
  }, []);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setStatus('guest');
    await Promise.all([deleteSecure(TOKEN_KEY), deleteSecure(USER_KEY)]);
  }, []);

  // Restore a persisted session on launch and verify it in the background.
  useEffect(() => {
    (async () => {
      if (!isApiConfigured()) {
        setStatus('guest');
        return;
      }
      try {
        const [token, rawUser] = await Promise.all([getSecure(TOKEN_KEY), getSecure(USER_KEY)]);
        if (!token || !rawUser) {
          setStatus('guest');
          return;
        }
        setAuthToken(token);
        setUser(JSON.parse(rawUser) as AuthUser);
        setStatus('authed');
        // Refresh/validate the token; sign out only on an explicit 401.
        try {
          const { user: fresh } = await fetchMe();
          setUser(fresh);
          await setSecure(USER_KEY, JSON.stringify(fresh));
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) await clearSession();
        }
      } catch {
        setStatus('guest');
      }
    })();
  }, [clearSession]);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password) => {
      const { token, user: u } = await apiLogin(email, password);
      await applySession(token, u);
    },
    [applySession],
  );

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (email, password, displayName) => {
      const { token, user: u } = await apiSignup(email, password, displayName);
      await applySession(token, u);
    },
    [applySession],
  );

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
