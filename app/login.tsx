import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image } from "react-native";
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
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      const url = `${API_BASE_URL}/api/mobile/auth/request-otp`;
      console.log(`[Login] POST ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      console.log(`[Login] request-otp ← ${res.status}`);
      const data = await res.json() as any;
      console.log(`[Login] request-otp body:`, JSON.stringify(data));

      if (!res.ok) {
        throw new Error(data.error || "Failed to request OTP");
      }

      // Only advance to OTP entry if the server confirmed the email was found
      setStep("OTP");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit code.");
      return;
    }

    setIsLoading(true);
    try {
      const url = `${API_BASE_URL}/api/mobile/auth/verify-otp`;
      console.log(`[Login] POST ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
      });
      console.log(`[Login] verify-otp ← ${res.status}`);

      const data = await res.json() as any;

      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      // Save token and user in global context
      await signIn(data.token, data.user);

      // Context routing logic will automatically take us to /(tabs)
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ffffff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, justifyContent: 'center', padding: 32 }}>

        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Image
            source={require('../assets/images/logo.png')}
            style={{ width: 200, height: 100, resizeMode: 'contain', marginBottom: 16 }}
          />
          <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
            {step === "EMAIL" ? "Enter your staff email to continue" : "Check your email for the 6-digit code"}
          </Text>
        </View>

        {/* Form Area */}
        {step === "EMAIL" ? (
          <View>
            <TextInput
              style={{
                backgroundColor: '#F3F4F6',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderRadius: 16,
                fontSize: 16,
                color: '#111827',
                marginBottom: 24,
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

            <TouchableOpacity
              onPress={handleRequestOtp}
              disabled={isLoading}
              style={{
                backgroundColor: '#F0A030',
                paddingVertical: 18,
                borderRadius: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                elevation: 2,
                shadowColor: '#F0A030',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 8
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Send Login Code</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TextInput
              style={{
                backgroundColor: '#F3F4F6',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderRadius: 16,
                fontSize: 24,
                letterSpacing: 8,
                textAlign: 'center',
                color: '#111827',
                marginBottom: 24,
                borderWidth: 1,
                borderColor: '#E5E7EB'
              }}
              placeholder="000000"
              placeholderTextColor="#D1D5DB"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
              editable={!isLoading}
            />

            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={isLoading}
              style={{
                backgroundColor: '#F0A030',
                paddingVertical: 18,
                borderRadius: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                elevation: 2,
                shadowColor: '#F0A030',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 8,
                marginBottom: 16
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Verify & Log In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStep("EMAIL")}
              style={{ alignItems: 'center', padding: 8 }}
            >
              <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: '600' }}>Wrong email? Go back</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}