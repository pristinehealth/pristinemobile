import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState, createContext, useContext } from "react";
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator, Alert } from "react-native";
import { disconnectSocket, joinStaffRoom } from '../lib/socket';
import { onSessionExpired } from '../lib/auth-events';

// 1. Create a simple Auth Context
type AuthContextType = {
  token: string | null;
  user: any | null;
  signIn: (token: string, user: any) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// 2. Auth Provider Component
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    async function loadToken() {
      try {
        const storedToken = await SecureStore.getItemAsync("auth_token");
        const storedUser = await SecureStore.getItemAsync("user_data");
        if (storedToken) {
          setToken(storedToken);
          if (storedUser) setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Failed to load token", e);
      } finally {
        setIsReady(true);
      }
    }
    loadToken();
  }, []);

  // Register session-expiry handler so any auth failure (socket or 401)
  // automatically signs the user out without them having to do it manually.
  useEffect(() => {
    onSessionExpired(async () => {
      await SecureStore.deleteItemAsync("auth_token");
      await SecureStore.deleteItemAsync("user_data");
      setToken(null);
      setUser(null);
      disconnectSocket();
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please log in again.",
        [{ text: "OK" }]
      );
    });
  }, []);

  // 3. Routing Logic based on Auth State
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const isLoginScreen = segments[0] === 'login';

    if (!token && inAuthGroup) {
      // Redirect to login if unauthenticated
      router.replace('/login');
    } else if (token && isLoginScreen) {
      // Redirect to tabs if authenticated
      router.replace('/(tabs)');
    }
  }, [token, segments, isReady]);

  const signIn = async (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    await SecureStore.setItemAsync("auth_token", newToken);
    await SecureStore.setItemAsync("user_data", JSON.stringify(newUser));
    // Join the socket room for this staff member immediately after login
    joinStaffRoom();
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("user_data");
    // Tear down the socket so we don't receive events for the old user
    disconnectSocket();
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3B6BB5" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ token, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// 4. Root Layout Definition
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        <Stack.Screen name="timesheet-modal" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen
          name="tasks/[id]"
          options={{
            headerShown: true,
            title: 'Shift Details',
            headerBackTitle: "Shifts",
            headerTintColor: "#ffffff",
            headerStyle: { backgroundColor: "#3B6BB5" },
            headerTitleStyle: { fontWeight: "700", color: "#ffffff" },
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="tasks/end-shift"
          options={{
            headerShown: true,
            title: "End Shift",
            headerBackTitle: "Back",
            headerTintColor: "#ffffff",
            headerStyle: { backgroundColor: "#3B6BB5" },
            headerTitleStyle: { fontWeight: "700", color: "#ffffff" },
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </AuthProvider>
  );
}