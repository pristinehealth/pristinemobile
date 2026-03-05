import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from "react-native";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../lib/api";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from "../_layout";

export default function ProfileTab() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { signOut } = useAuth();

    const loadProfile = async () => {
        try {
            const res = await fetchWithAuth("/api/mobile/profile");
            const json = await res.json();
            if (json.success && json.data) {
                setProfile(json.data);
            }
        } catch (err) {
            console.error("Failed to load profile", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadProfile();
    };

    const InfoRow = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 12, marginRight: 16 }}>
                <MaterialCommunityIcons name={icon} size={24} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
                <Text style={{ fontSize: 16, color: '#111827', fontWeight: '500' }}>{value || 'Not provided'}</Text>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {loading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
                    }
                >
                    {/* Avatar Header */}
                    <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 20 }}>
                        <View style={{
                            width: 100,
                            height: 100,
                            borderRadius: 50,
                            backgroundColor: '#4F46E5',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 16,
                            elevation: 4,
                            shadowColor: '#4F46E5',
                            shadowOpacity: 0.3,
                            shadowOffset: { width: 0, height: 4 },
                            shadowRadius: 12
                        }}>
                            <Text style={{ fontSize: 36, fontWeight: '800', color: '#ffffff' }}>
                                {profile?.firstname ? profile.firstname.charAt(0) : 'S'}
                            </Text>
                        </View>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                            {profile?.firstname} {profile?.lastname}
                        </Text>
                        <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                            <Text style={{ color: '#4F46E5', fontSize: 14, fontWeight: '700' }}>
                                {profile?.role ? 'Role ID: ' + profile.role : 'Staff Member'}
                            </Text>
                        </View>
                    </View>

                    {/* Details Card */}
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 20, elevation: 2, shadowColor: '#111827', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 }}>
                        <InfoRow icon="email-outline" label="Email Address" value={profile?.email} />
                        <InfoRow icon="phone-outline" label="Phone Number" value={profile?.phonenumber} />
                        <InfoRow icon="calendar-account-outline" label="Date Joined" value={profile?.datecreated ? new Date(profile.datecreated).toLocaleDateString() : ''} />
                    </View>

                    {/* Logout Button */}
                    <TouchableOpacity
                        onPress={signOut}
                        style={{
                            backgroundColor: '#FEF2F2',
                            paddingVertical: 18,
                            borderRadius: 16,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            marginTop: 40,
                            borderWidth: 1,
                            borderColor: '#FEE2E2'
                        }}
                    >
                        <MaterialCommunityIcons name="logout" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '700' }}>Log Out from Device</Text>
                    </TouchableOpacity>

                </ScrollView>
            )}
        </View>
    );
}
