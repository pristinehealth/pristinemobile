/**
 * Minimal global registry for session-expiry events.
 * Both the socket client and fetchWithAuth hook into this so any
 * auth failure automatically triggers a sign-out + redirect to login,
 * without the user needing to manually log out.
 */
type Listener = () => void;
let _listener: Listener | null = null;

/** Register the signOut callback (called once from _layout.tsx AuthProvider). */
export function onSessionExpired(cb: Listener) {
    _listener = cb;
}

/** Fire the session-expired event (called from socket auth error or 401 response). */
export function emitSessionExpired() {
    _listener?.();
}
