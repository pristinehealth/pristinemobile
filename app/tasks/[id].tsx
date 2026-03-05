import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LiveTimer from "../../components/LiveTimer";
import * as Location from 'expo-location';

// Haversine formula to get distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default function TaskDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch Task Details
    const fetchAllData = async (isRefresh = false) => {
        try {
            const res = await fetchWithAuth(`/api/mobile/tasks${isRefresh ? '?refresh=true' : ''}`);
            const json = (await res.json()) as any;

            if (json.success && json.data) {
                const foundTask = json.data.find((t: any) => t.id === id);
                setTask(foundTask);
            }
        } catch (err) {
            console.error("Failed to load task details", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [id]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllData(true);
    };

    const handleTimerAction = async (action: 'start' | 'stop') => {
        try {
            if (action === 'start') {
                // Determine Geofencing Requirements from custom fields compiled by backend
                const customFields = task?.project_data?.customfields || [];
                const latField = customFields.find((f: any) => f.label?.toLowerCase().includes("latitude"));
                const lngField = customFields.find((f: any) => f.label?.toLowerCase().includes("longitude"));

                // If coordinates exist for this project, enforce them
                if (latField?.value && lngField?.value) {
                    const targetLat = parseFloat(latField.value);
                    const targetLng = parseFloat(lngField.value);

                    if (!isNaN(targetLat) && !isNaN(targetLng)) {
                        // Find dynamic radius explicitly (fallback to 20m if unspecified)
                        const radiusField = customFields.find((f: any) => f.label?.toLowerCase().includes("radius"));
                        const allowedRadius = radiusField && !isNaN(parseFloat(radiusField.value)) ? parseFloat(radiusField.value) : 20;

                        setActionLoading(true);

                        let { status } = await Location.requestForegroundPermissionsAsync();
                        if (status !== 'granted') {
                            setActionLoading(false);
                            Alert.alert('Permission Denied', 'Location permissions are required to start shifts at this facility.');
                            return;
                        }

                        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                        const userLat = location.coords.latitude;
                        const userLng = location.coords.longitude;

                        const distance = getDistance(userLat, userLng, targetLat, targetLng);

                        if (distance > allowedRadius) {
                            setActionLoading(false);
                            Alert.alert(
                                'Out of Range',
                                `You are currently ${Math.round(distance)} meters away from the client facility. You must be within ${allowedRadius} meters to begin your shift.`
                            );
                            return;
                        }
                    }
                }
            }

            setActionLoading(true);

            const res = await fetchWithAuth("/api/mobile/timesheets/action", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: id,
                    action: action,
                    note: `Shift ${action}ed via Mobile App`
                })
            });

            const json = (await res.json()) as any;
            if (res.ok && json.success) {
                if (action === 'start') {
                    setTask((prev: any) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            timesheets: [...(prev.timesheets || []), {
                                task_id: id,
                                start_time: String(Math.floor(Date.now() / 1000)),
                                end_time: "0"
                            }]
                        };
                    });
                }
                Alert.alert(action === 'start' ? "Shift Started" : "Shift Ended",
                    action === 'start' ? "Your time is now being tracked locally." : "Timesheet successfully submitted to Perfex!");
                onRefresh();
            } else {
                throw new Error(json.error || `Failed to ${action} shift`);
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !refreshing) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    if (!task && !loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <Text style={{ fontSize: 18, color: '#6B7280' }}>Shift not found.</Text>
                <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
                    <Text style={{ color: '#4F46E5', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Check explicitly for '0' or '' or null which are native "Ongoing" states inside Perfex
    const nativeActiveTimesheet = task?.timesheets?.find((ts: any) => ts.end_time === null || ts.end_time === "0" || ts.end_time === "");
    const isTimerRunning = !!(nativeActiveTimesheet && nativeActiveTimesheet.task_id === id);
    const activeStartTime = nativeActiveTimesheet
        ? (/^\d+$/.test(String(nativeActiveTimesheet.start_time))
            ? parseInt(nativeActiveTimesheet.start_time)
            : Math.floor(new Date(String(nativeActiveTimesheet.start_time).replace(' ', 'T')).getTime() / 1000))
        : null;

    // Check if another shift is active globally to prevent dual-timer confusion
    const isAnotherShiftActive = !isTimerRunning && (nativeActiveTimesheet && nativeActiveTimesheet.task_id !== id);

    const clientData = task.project_data?.client_data;

    return (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <Stack.Screen options={{ title: task?.name || "Shift Details", headerBackTitle: "Back" }} />

            <ScrollView
                contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
                }
            >

                {/* Task Title & Company */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                        {task.name}
                    </Text>
                    {task.project_data && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="office-building" size={20} color="#6B7280" style={{ marginRight: 8 }} />
                            <Text style={{ fontSize: 16, color: '#4B5563', fontWeight: '500' }}>
                                {task.project_data.name || "Unknown Project"}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Client Contact Info Card */}
                {clientData && (
                    <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 12 }}>
                            Client Information
                        </Text>

                        {clientData.address && (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                                <MaterialCommunityIcons name="map-marker" size={18} color="#4F46E5" style={{ marginRight: 10, marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 15, color: '#111827' }}>{clientData.address.replace(/<[^>]+>/g, '')}</Text>
                                    {(clientData.city || clientData.zip) && (
                                        <Text style={{ fontSize: 15, color: '#111827', marginTop: 2 }}>{clientData.city} {clientData.zip}</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {clientData.phonenumber && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="phone" size={18} color="#4F46E5" style={{ marginRight: 10 }} />
                                <Text style={{ fontSize: 15, color: '#111827' }}>{clientData.phonenumber}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Info Cards */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
                    <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>DATE</Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
                            {task.startdate ? new Date(task.startdate.replace(' ', 'T')).toLocaleDateString() : 'Unscheduled'}
                        </Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginLeft: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>STATUS</Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
                            {task.status === "5" ? "Complete" : task.status === "4" ? "In Progress" : "Scheduled"}
                        </Text>
                    </View>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                    onPress={() => isTimerRunning ? router.push(`/tasks/end-shift?id=${id}`) : handleTimerAction('start')}
                    disabled={actionLoading || task.status === "5" || isAnotherShiftActive}
                    style={{
                        backgroundColor: isTimerRunning ? '#EF4444' : (task.status === "5" || isAnotherShiftActive ? '#D1D5DB' : '#10B981'),
                        paddingVertical: 18,
                        borderRadius: 16,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        elevation: 4,
                        shadowColor: isTimerRunning ? '#EF4444' : '#10B981',
                        shadowOpacity: 0.3,
                        shadowOffset: { width: 0, height: 4 },
                        shadowRadius: 12,
                        marginBottom: 32
                    }}
                >
                    {actionLoading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : isTimerRunning ? (
                        <>
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', marginRight: 8 }}>Stop Shift -</Text>
                            {activeStartTime && <LiveTimer startTimeUnix={activeStartTime} />}
                        </>
                    ) : (
                        <>
                            <MaterialCommunityIcons name="clock-start" size={24} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
                                {isAnotherShiftActive ? "Another Shift Active" : "Start Shift"}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Description */}
                {task.description && task.description.trim().length > 0 && (
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Instructions</Text>
                        <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
                            <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 24 }}>
                                {task.description.replace(/<[^>]+>/g, '').trim()}
                            </Text>
                        </View>
                    </View>
                )}

            </ScrollView>
        </View>
    );
}
