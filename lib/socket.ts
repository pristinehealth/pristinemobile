// lib/socket.ts — Mobile Socket.IO client singleton
// Connects to the pristineBack Socket.IO server using JWT authentication.
// The server verifies the token and auto-joins the staff's room server-side.

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './api';

let socket: Socket | null = null;

/**
 * Returns the shared Socket.IO client, creating it on first call.
 * Requires a JWT token in SecureStore — call after the user is authenticated.
 */
export async function initSocket(): Promise<Socket> {
    if (socket?.connected) return socket;

    // Retrieve the JWT token from SecureStore
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) throw new Error('[Socket.IO] No JWT token found — user must be logged in');

    // Disconnect stale socket before creating a new one (e.g. after logout/re-login)
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    socket = io(API_BASE_URL, {
        transports: ['websocket'],
        path: '/socket.io',
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,        // finite retries for network drops
        reconnectionDelay: 2000,
        auth: { token },
    });

    socket.on('connect', () => {
        console.log('[Socket.IO] Authenticated & connected:', socket?.id);
    });

    socket.on('connect_error', (err) => {
        console.warn('[Socket.IO] Connection error (non-fatal):', err.message);
        // Auth failures are permanent — stop reconnecting.
        // Do NOT sign the user out: socket is non-essential and its JWT
        // may differ from the API JWT (e.g. different server). App works fine without it.
        if (err.message.toLowerCase().includes('auth')) {
            socket?.disconnect();
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket.IO] Disconnected:', reason);
    });

    return socket;
}

/**
 * Returns the existing socket instance, or null if not yet initialized.
 * Use initSocket() to create the authenticated connection.
 */
export function getSocket(): Socket | null {
    return socket;
}

/**
 * Initialize the authenticated socket connection.
 * Room join is handled server-side — the server extracts staff_id from JWT.
 */
export async function joinStaffRoom(): Promise<void> {
    try {
        await initSocket();
    } catch (err) {
        console.warn('[Socket.IO] joinStaffRoom failed:', err);
    }
}

/** Disconnect and destroy the socket (call on logout). */
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
