import {
    View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert, ScrollView, Image
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from './_layout';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 'http://localhost:3000';

type Step = 'FORM' | 'VERIFY';

export default function SignupScreen() {
    const router = useRouter();
    const { signIn } = useAuth();

    const [step, setStep] = useState<Step>('FORM');
    const [isLoading, setIsLoading] = useState(false);

    // Form fields
    const [firstname, setFirstname] = useState("");
    const [lastname, setLastname] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // OTP step
    const [otpCode, setOtpCode] = useState("");
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

    const handleSignup = async () => {
        if (!firstname.trim() || !lastname.trim()) {
            Alert.alert("Required", "Please enter your first and last name.");
            return;
        }
        if (!email || !email.includes('@')) {
            Alert.alert("Invalid Email", "Please enter a valid email address.");
            return;
        }
        if (password.length < 8) {
            Alert.alert("Weak Password", "Password must be at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Passwords Don't Match", "Please make sure both passwords match.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/mobile/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                    firstname: firstname.trim(),
                    lastname: lastname.trim()
                }),
            });

            const data = await res.json() as any;
            if (!res.ok) throw new Error(data.error || "Signup failed.");

            startCooldown();
            setStep('VERIFY');
        } catch (error: any) {
            Alert.alert("Signup Failed", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!otpCode || otpCode.length !== 6) {
            Alert.alert("Invalid Code", "Please enter the 6-digit code from your email.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/mobile/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), code: otpCode.trim() }),
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
                body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'verification' }),
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
                        {step === 'FORM' ? 'Create Your Account' : 'Verify Your Email'}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
                        {step === 'FORM'
                            ? 'Your email must be registered in the system by an administrator.'
                            : `We sent a 6-digit code to ${email}`}
                    </Text>
                </View>

                {step === 'FORM' ? (
                    <View>
                        {/* First / Last Name row */}
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                            <TextInput
                                style={{ flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' }}
                                placeholder="First Name"
                                placeholderTextColor="#9CA3AF"
                                value={firstname}
                                onChangeText={setFirstname}
                                editable={!isLoading}
                            />
                            <TextInput
                                style={{ flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' }}
                                placeholder="Last Name"
                                placeholderTextColor="#9CA3AF"
                                value={lastname}
                                onChangeText={setLastname}
                                editable={!isLoading}
                            />
                        </View>

                        <TextInput
                            style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16, fontSize: 16, color: '#111827', marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' }}
                            placeholder="Email Address"
                            placeholderTextColor="#9CA3AF"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            editable={!isLoading}
                        />

                        {/* Password */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 20, marginBottom: 16 }}>
                            <TextInput
                                style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                                placeholder="Password (min. 8 characters)"
                                placeholderTextColor="#9CA3AF"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
                                <MaterialCommunityIcons name={showPassword ? "eye-off" : "eye"} size={22} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {/* Confirm Password */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 20, marginBottom: 28 }}>
                            <TextInput
                                style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: '#111827' }}
                                placeholder="Confirm Password"
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
                            onPress={handleSignup}
                            disabled={isLoading}
                            style={{ backgroundColor: '#3B6BB5', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#3B6BB5', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, marginBottom: 20 }}
                        >
                            {isLoading ? <ActivityIndicator color="#ffffff" /> : (
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Create Account</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', padding: 8 }}>
                            <Text style={{ color: '#6B7280', fontSize: 14 }}>
                                Already have an account?{' '}
                                <Text style={{ color: '#3B6BB5', fontWeight: '700' }}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
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
                            style={{ backgroundColor: '#3B6BB5', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#3B6BB5', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, marginBottom: 16 }}
                        >
                            {isLoading ? <ActivityIndicator color="#ffffff" /> : (
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Verify & Activate Account</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0} style={{ alignItems: 'center', padding: 10 }}>
                            <Text style={{ color: resendCooldown > 0 ? '#9CA3AF' : '#3B6BB5', fontSize: 14, fontWeight: '600' }}>
                                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setStep('FORM')} style={{ alignItems: 'center', padding: 8, marginTop: 4 }}>
                            <Text style={{ color: '#6B7280', fontSize: 14 }}>← Back to form</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
