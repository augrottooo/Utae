import { create } from 'zustand';

interface MockSessionState {
  signedIn: boolean;
  toggleMockSession(): void;
}

const sessionKey = 'utae:mock-session:v1';
function readMockSession() {
  try {
    return sessionStorage.getItem(sessionKey) === 'signed-in';
  } catch {
    return false;
  }
}

export const useMockSession = create<MockSessionState>((set) => ({
  signedIn: readMockSession(),
  toggleMockSession: () =>
    set((state) => {
      const signedIn = !state.signedIn;
      try {
        sessionStorage.setItem(sessionKey, signedIn ? 'signed-in' : 'signed-out');
      } catch {
        // This is a demo UI flag, never a credential or authorization source.
      }
      return { signedIn };
    }),
}));
