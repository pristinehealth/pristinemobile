import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 'http://localhost:3000';

/**
 * A wrapper around native `fetch` that automatically injects the JWT token
 * from `expo-secure-store` into the `Authorization` header.
 */
export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    // Retrieve token
    const token = await SecureStore.getItemAsync('auth_token');

    // Prepare headers
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Ensure endpoint starts with slash if not provided
    const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return fetch(`${API_BASE_URL}${formattedEndpoint}`, {
        ...options,
        headers,
    });
}
