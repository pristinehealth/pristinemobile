import {
    View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert, Image
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import Constants from 'expo-constants';
import { useAuth } from './_layout';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 'http://localhost:3000';

// Standalone verify-email screen — used when login detects EMAIL_NOT_VERIFIED
export default function VerifyEmailScreen() {
    const router = useRouter();
    const { signIn } = useAuth();
    const { email: emailParam } = useLocalSearchParams<{ email: string }>();

    const [email] = useState(emailParam || '');
    const [otpCode, setOtpCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(50); // already sent from login
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        startCooldown();
        return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
    }, []);

    const startCooldown = () => {
        setResendCooldown(60);
        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleVerify = async () => {
        if (!otpCode || otpCode.length !== 6) {
            Alert.alert("Invalid Code", "Please enter the 6-digit verification code.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/mobile/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: otpCode.trim() }),
            });

            const data = await res.json() as any;
            if (!res.ok) throw new Error(data.error || "Verification failed.");

            await signIn(data.token, data.user);
        } catch (error: any) {
            Alert.alert("Verification Failed", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        try {
            await fetch(`${API_BASE_URL}/api/mobile/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, purpose: 'verification' }),
            });
            startCooldown();
            Alert.alert("Code Resent", "A new verification code has been sent to your email.");
        } catch {
            Alert.alert("Error", "Failed to resend code. Please try again.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={{ flex: 1, justifyContent: 'center', padding: 32 }}>
                <View style={{ alignItems: 'center', marginBottom: 36 }}>
                    <Image
                        source={require('../assets/images/logo.png')}
                        style={{ width: 160, height: 80, resizeMode: 'contain', marginBottom: 12 }}
                    />
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 }}>Verify Your Email</Text>
                    <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
                        Enter the 6-digit code sent to{'\n'}<Text style={{ fontWeight: '700', color: '#111827' }}>{email}</Text>
                    </Text>
                </View>

                <TextInput
                    style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 20, borderRadius: 16, fontSize: 28, letterSpacing: 10, textAlign: 'center', color: '#111827', marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' }}
                    placeholder="000000"
                    placeholderTextColor="#D1D5DB"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isLoading}
                />

                <TouchableOpacity
                    onPress={handleVerify}
                    disabled={isLoading}
                    style={{ backgroundColor: '#3B6BB5', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
                >
                    {isLoading ? <ActivityIndicator color="#ffffff" /> : (
                        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Verify & Sign In</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0} style={{ alignItems: 'center', padding: 10 }}>
                    <Text style={{ color: resendCooldown > 0 ? '#9CA3AF' : '#3B6BB5', fontSize: 14, fontWeight: '600' }}>
                        {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.replace('/login')} style={{ alignItems: 'center', padding: 8, marginTop: 4 }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>← Back to Login</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
