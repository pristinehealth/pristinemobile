import {
    View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert, ScrollView, Image
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 'http://localhost:3000';

type Step = 'EMAIL' | 'OTP' | 'NEW_PASSWORD';

export default function ForgotPasswordScreen() {
    const router = useRouter();

    const [step, setStep] = useState<Step>('EMAIL');
    const [isLoading, setIsLoading] = useState(false);

    const [email, setEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
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

    const handleRequestReset = async () => {
        if (!email || !email.includes('@')) {
            Alert.alert("Invalid Email", "Please enter a valid email address.");
            return;
        }

        setIsLoading(true);
        try {
            await fetch(`${API_BASE_URL}/api/mobile/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'reset' }),
            });
            startCooldown();
            setStep('OTP');
        } catch {
            Alert.alert("Error", "Failed to send reset code. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = () => {
        if (!otpCode || otpCode.length !== 6) {
            Alert.alert("Invalid Code", "Please enter the 6-digit code from your email.");
            return;
        }
        setStep('NEW_PASSWORD');
    };

    const handleResetPassword = async () => {
        if (newPassword.length < 8) {
            Alert.alert("Weak Password", "Password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Passwords Don't Match", "Please make sure both passwords match.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/mobile/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code: otpCode.trim(),
                    newPassword
                }),
            });

            const data = await res.json() as any;
            if (!res.ok) throw new Error(data.error || "Password reset failed.");

            Alert.alert("Password Reset", "Your password has been updated. You can now log in.", [
                { text: "Log In", onPress: () => router.replace('/login') }
            ]);
        } catch (error: any) {
            Alert.alert("Reset Failed", error.message);
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
                body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'reset' }),
            });
            startCooldown();
            Alert.alert("Code Resent", "A new reset code has been sent to your email.");
        } catch {
            Alert.alert("Error", "Failed to resend code.");
        }
    };

    const stepTitles: Record<Step, string> = {
        EMAIL: 'Reset Your Password',
        OTP: 'Enter Reset Code',
        NEW_PASSWORD: 'Set New Password'
    };

    const stepSubtitles: Record<Step, string> = {
        EMAIL: 'Enter your staff email. We\'ll send you a reset code.',
        OTP: `We sent a 6-digit code to ${email}`,
        NEW_PASSWORD: 'Choose a strong new password.'
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
                <View style={{ alignItems: 'center', marginBottom: 36 }}>
                    <Image
                        source={require('../assets/images/logo.png')}
                        style={{ width: 160, height: 80, resizeMode: 'contain', marginBottom: 12 }}
                    />
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
                        {stepTitles[step]}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
                        {stepSubtitles[step]}
                    </Text>
                </View>

                {/* Step: EMAIL */}
                {step === 'EMAIL' && (
                    <View>
                        <TextInput
                            style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16, fontSize: 16, color: '#111827', marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' }}
                            placeholder="Email Address"
                            placeholderTextColor="#9CA3AF"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            editable={!isLoading}
                        />
                        <TouchableOpacity
                            onPress={handleRequestReset}
                            disabled={isLoading}
                            style={{ backgroundColor: '#3B6BB5', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#3B6BB5', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, marginBottom: 16 }}
                        >
                            {isLoading ? <ActivityIndicator color="#ffffff" /> : (
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Send Reset Code</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', padding: 8 }}>
                            <Text style={{ color: '#6B7280', fontSize: 14 }}>← Back to Login</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Step: OTP */}
                {step === 'OTP' && (
                    <View>
                        <TextInput
                            style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 20, borderRadius: 16, fontSize: 28, letterSpacing: 10, textAlign: 'center', color: '#111827', marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' }}
                            placeholder="000000"
                            placeholderTextColor="#D1D5DB"
                            value={otpCode}
                            onChangeText={setOtpCode}
                            keyboardType="number-pad"
                            maxLength={6}
                        />
                        <TouchableOpacity
                            onPress={handleVerifyOtp}
                            style={{ backgroundColor: '#3B6BB5', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
                        >
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Continue</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0} style={{ alignItems: 'center', padding: 10 }}>
                            <Text style={{ color: resendCooldown > 0 ? '#9CA3AF' : '#3B6BB5', fontSize: 14, fontWeight: '600' }}>
                                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setStep('EMAIL')} style={{ alignItems: 'center', padding: 8, marginTop: 4 }}>
                            <Text style={{ color: '#6B7280', fontSize: 14 }}>← Wrong email? Go back</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Step: NEW_PASSWORD */}
                {step === 'NEW_PASSWORD' && (
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 20, marginBottom: 16 }}>
                            <TextInput
                                style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                                placeholder="New Password (min. 8 characters)"
                                placeholderTextColor="#9CA3AF"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
                                <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={22} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 20, marginBottom: 28 }}>
                            <TextInput
                                style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                                placeholder="Confirm New Password"
                                placeholderTextColor="#9CA3AF"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showConfirm}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                            <TouchableOpacity onPress={() => setShowConfirm(p => !p)}>
                                <MaterialCommunityIcons name={showConfirm ? "eye-off" : "eye"} size={22} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            onPress={handleResetPassword}
                            disabled={isLoading}
                            style={{ backgroundColor: '#10B981', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#10B981', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, marginBottom: 16 }}
                        >
                            {isLoading ? <ActivityIndicator color="#ffffff" /> : (
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Save New Password</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setStep('OTP')} style={{ alignItems: 'center', padding: 8 }}>
                            <Text style={{ color: '#6B7280', fontSize: 14 }}>← Back</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
