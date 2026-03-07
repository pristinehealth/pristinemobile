import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Image, ScrollView
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from './_layout';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 'http://localhost:3000';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!password) {
      Alert.alert("Password Required", "Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json() as any;

      if (res.status === 403 && data.error === 'EMAIL_NOT_VERIFIED') {
        // Drop them into signup verification screen with email prefilled
        Alert.alert(
          "Email Not Verified",
          "Your account isn't verified yet. We'll send a new code to your email.",
          [{
            text: "Send Code",
            onPress: async () => {
              await fetch(`${API_BASE_URL}/api/mobile/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'verification' }),
              });
              router.push(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
            }
          }, { text: "Cancel", style: "cancel" }]
        );
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Login failed. Please try again.");
      }

      await signIn(data.token, data.user);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Image
            source={require('../assets/images/logo.png')}
            style={{ width: 200, height: 100, resizeMode: 'contain', marginBottom: 16 }}
          />
          <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
            Sign in to your staff account
          </Text>
        </View>

        {/* Email */}
        <TextInput
          style={{
            backgroundColor: '#F3F4F6',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderRadius: 16,
            fontSize: 16,
            color: '#111827',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB'
          }}
          placeholder="Email Address"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!isLoading}
        />

        {/* Password */}
        <View style={{ marginBottom: 12 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F3F4F6',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            paddingHorizontal: 20,
          }}>
            <TextInput
              style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={{ padding: 4 }}>
              <MaterialCommunityIcons
                name={showPassword ? "eye-off" : "eye"}
                size={22}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot Password */}
        <TouchableOpacity
          onPress={() => router.push('/forgot-password')}
          style={{ alignSelf: 'flex-end', marginBottom: 28 }}
        >
          <Text style={{ color: '#3B6BB5', fontSize: 14, fontWeight: '600' }}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Sign In Button */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={isLoading}
          style={{
            backgroundColor: '#F0A030',
            paddingVertical: 18,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 2,
            shadowColor: '#F0A030',
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 8,
            marginBottom: 20
          }}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Create Account */}
        <TouchableOpacity
          onPress={() => router.push('/signup')}
          style={{ alignItems: 'center', padding: 8 }}
        >
          <Text style={{ color: '#6B7280', fontSize: 14 }}>
            New staff member?{' '}
            <Text style={{ color: '#3B6BB5', fontWeight: '700' }}>Create Account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}