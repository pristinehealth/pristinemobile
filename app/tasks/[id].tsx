import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, RefreshControl, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { fetchWithAuth } from "../../lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LiveTimer from "../../components/LiveTimer";
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from 'react-native-maps';

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
    const [verifyingLocation, setVerifyingLocation] = useState(false);
    const mapRef = useRef<MapView>(null);
    const [locationPermission, setLocationPermission] = useState(false);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [showAgreementModal, setShowAgreementModal] = useState(false);

    const SHIFT_AGREEMENT_TEXT =
        "By starting this shift, I confirm I will work only the assigned hours. " +
        "Any hours beyond what was scheduled must be pre-approved by management BEFORE they are worked. " +
        "Unapproved overtime will not be compensated.";

    // Request ambient location permissions for the map
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                setLocationPermission(true);
            }
        })();
    }, []);

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
            let userLat = undefined;
            let userLng = undefined;

            if (action === 'start') {
                if (hasCoordinates) {
                    setVerifyingLocation(true);

                    let { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        setVerifyingLocation(false);
                        Alert.alert('Permission Denied', 'Location permissions are required to start shifts at this facility.');
                        return;
                    }

                    // Performance Upgrade: Use `getLastKnownPositionAsync` for instant resolution from OS Cache.
                    // Fallback to low-accuracy fetch if the cache is totally cold.
                    let location = await Location.getLastKnownPositionAsync();
                    if (!location) {
                        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
                    }

                    userLat = location.coords.latitude;
                    userLng = location.coords.longitude;

                    setVerifyingLocation(false);
                }
            }

            setActionLoading(true);

            const payload: any = {
                task_id: id,
                action: action,
                note: action === 'start'
                    ? `[SHIFT AGREEMENT] ${SHIFT_AGREEMENT_TEXT}`
                    : `Shift stopped via Mobile App`
            };

            // Pass coordinates down to the CRM API for secure server-side verification
            if (userLat !== undefined && userLng !== undefined) {
                payload.user_lat = userLat;
                payload.user_lng = userLng;
            }

            const res = await fetchWithAuth("/api/mobile/timesheets/action", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
                    action === 'start' ? "Your time is now being tracked locally." : "Timesheet successfully submitted and sent to the administrator for review.");
                onRefresh();
            } else {
                throw new Error(json.error || `Failed to ${action} shift`);
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setActionLoading(false);
            setVerifyingLocation(false);
        }
    };

    if (loading && !refreshing) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <ActivityIndicator size="large" color="#3B6BB5" />
            </View>
        );
    }

    if (!task && !loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <Text style={{ fontSize: 18, color: '#6B7280' }}>Shift not found.</Text>
                <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
                    <Text style={{ color: '#3B6BB5', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
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

    // Pre-Extract coordinates for Map Rendering
    const customFields = task?.project_data?.customfields || [];
    const latField = customFields.find((f: any) => f.label?.toLowerCase().includes("latitude"));
    const lngField = customFields.find((f: any) => f.label?.toLowerCase().includes("longitude"));
    const targetLat = latField?.value ? parseFloat(latField.value) : null;
    const targetLng = lngField?.value ? parseFloat(lngField.value) : null;
    const hasCoordinates = targetLat !== null && !isNaN(targetLat) && targetLng !== null && !isNaN(targetLng);
    const radiusField = customFields.find((f: any) => f.label?.toLowerCase().includes("radius"));
    const allowedRadius = radiusField && !isNaN(parseFloat(radiusField.value)) ? parseFloat(radiusField.value) : 50;

    const addressField = customFields.find((f: any) => f.label?.toLowerCase().includes("address"));
    const cityField = customFields.find((f: any) => f.label?.toLowerCase().includes("city"));
    const stateField = customFields.find((f: any) => f.label?.toLowerCase().includes("state") || f.label?.toLowerCase() === "st");
    const zipField = customFields.find((f: any) => f.label?.toLowerCase().includes("zip") || f.label?.toLowerCase() === "postal");

    // Convert meters to coordinate delta (1 lat degree = ~111km)
    // Multiplied by 3 to give the circle some nice padding inside the map view
    const coordDelta = (allowedRadius * 3) / 111000;
    // Enforce a minimum zoom out of ~0.002 to avoid being confusingly close
    const zoomDelta = Math.max(coordDelta, 0.002);

    // --- Date Guard: shift can only start on its scheduled date ---
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    const rawTaskDate = task?.startdate || '';
    const taskDateStr = rawTaskDate ? String(rawTaskDate).split(' ')[0].split('T')[0] : '';
    const isWrongDate = !isTimerRunning && taskDateStr && todayStr !== taskDateStr;

    // --- 15-min stop guard ---
    const nowUnix = Math.floor(Date.now() / 1000);
    const elapsedSeconds = isTimerRunning && activeStartTime ? nowUnix - activeStartTime : 0;
    const MIN_SHIFT_SECONDS = 15 * 60; // 900 s
    const canStopShift = !isTimerRunning || elapsedSeconds >= MIN_SHIFT_SECONDS;
    const remainingStopSec = isTimerRunning ? Math.max(0, MIN_SHIFT_SECONDS - elapsedSeconds) : 0;
    const remainingStopMin = Math.floor(remainingStopSec / 60);
    const remainingStopSecPart = remainingStopSec % 60;

    return (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>

            <ScrollView
                contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B6BB5" />
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
                            Service Information
                        </Text>

                        {(addressField?.value || clientData.address) && (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                                <MaterialCommunityIcons name="map-marker" size={18} color="#3B6BB5" style={{ marginRight: 10, marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 15, color: '#111827' }}>{(addressField?.value || clientData.address)?.replace(/<[^>]+>/g, '')}</Text>
                                    {(cityField?.value || zipField?.value || clientData.city || clientData.zip) && (
                                        <Text style={{ fontSize: 15, color: '#111827', marginTop: 2 }}>{cityField?.value || clientData.city} {stateField?.value || clientData.state} {zipField?.value || clientData.zip}</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {hasCoordinates && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#3B6BB5" style={{ marginRight: 10 }} />
                                <Text style={{ fontSize: 13, color: '#6B7280', fontFamily: 'Courier' }}>
                                    Lat: {targetLat} | Lng: {targetLng}
                                </Text>
                            </View>
                        )}

                        {clientData.phonenumber && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="phone" size={18} color="#3B6BB5" style={{ marginRight: 10 }} />
                                <Text style={{ fontSize: 15, color: '#111827' }}>{clientData.phonenumber}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Location Map View */}
                {hasCoordinates && (
                    <TouchableOpacity
                        onPress={() => setMapModalVisible(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3FB', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#5585CC', marginBottom: 24 }}
                    >
                        <MaterialCommunityIcons name="map-search" size={24} color="#3B6BB5" style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#3B6BB5' }}>Show Service Facility Map</Text>
                    </TouchableOpacity>
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

                {/* Date-lock notice */}
                {isWrongDate && (
                    <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' }}>
                        <MaterialCommunityIcons name="calendar-alert" size={20} color="#D97706" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#92400E', fontSize: 14, fontWeight: '600', flex: 1 }}>
                            Shift opens on {new Date(taskDateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                    </View>
                )}

                {/* 15-min stop notice */}
                {isTimerRunning && !canStopShift && (
                    <View style={{ backgroundColor: '#EEF3FB', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#5585CC' }}>
                        <MaterialCommunityIcons name="timer-sand" size={20} color="#3B6BB5" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#1E3A5F', fontSize: 14, fontWeight: '600', flex: 1 }}>
                            Can stop after 15 min · {remainingStopMin}m {remainingStopSecPart}s remaining
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    onPress={() => {
                        if (isTimerRunning) {
                            if (!canStopShift) {
                                Alert.alert("Too Early", `You cannot stop the shift until at least 15 minutes have elapsed. Please wait ${remainingStopMin}m ${remainingStopSecPart}s more.`);
                                return;
                            }
                            router.push(`/tasks/end-shift?id=${id}`);
                        } else {
                            // Show agreement modal before starting
                            setShowAgreementModal(true);
                        }
                    }}
                    disabled={actionLoading || verifyingLocation || task.status === "5" || isAnotherShiftActive || (!isTimerRunning && !!isWrongDate)}
                    style={{
                        backgroundColor: isTimerRunning
                            ? (canStopShift ? '#EF4444' : '#9CA3AF')
                            : (task.status === "5" || isAnotherShiftActive || isWrongDate ? '#D1D5DB' : '#10B981'),
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
                    {verifyingLocation ? (
                        <>
                            <ActivityIndicator color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Verifying Location...</Text>
                        </>
                    ) : actionLoading ? (
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
                                {isAnotherShiftActive ? "Another Shift Active" : isWrongDate ? "Not Scheduled Today" : "Start Shift"}
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

            {hasCoordinates && (
                <Modal visible={mapModalVisible} animationType="slide" presentationStyle="pageSheet">
                    <View style={{ flex: 1, backgroundColor: '#000' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#111827' }}>
                            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Service Facility Map</Text>
                            <TouchableOpacity onPress={() => setMapModalVisible(false)} style={{ backgroundColor: '#374151', padding: 8, borderRadius: 20 }}>
                                <MaterialCommunityIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <MapView
                            ref={mapRef}
                            style={{ flex: 1 }}
                            initialRegion={{
                                latitude: targetLat!,
                                longitude: targetLng!,
                                latitudeDelta: zoomDelta,
                                longitudeDelta: zoomDelta,
                            }}
                            showsUserLocation={locationPermission}
                            showsMyLocationButton={true}
                        >
                            <Circle
                                center={{ latitude: targetLat!, longitude: targetLng! }}
                                radius={allowedRadius}
                                fillColor="rgba(239, 68, 68, 0.2)"
                                strokeColor="rgba(239, 68, 68, 0.8)"
                                strokeWidth={2}
                            />
                            <Marker
                                coordinate={{ latitude: targetLat!, longitude: targetLng! }}
                                title="Service Facility Location"
                                description={`Staff must be within ${allowedRadius}m · Start up to 100 min early`}
                            >
                                <View style={{ backgroundColor: '#EF4444', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' }}>
                                    <MaterialCommunityIcons name="home-city" size={20} color="#fff" />
                                </View>
                            </Marker>
                        </MapView>

                        <TouchableOpacity
                            style={{
                                position: 'absolute',
                                bottom: 40,
                                alignSelf: 'center',
                                backgroundColor: '#111827',
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                borderRadius: 30,
                                flexDirection: 'row',
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 6,
                                elevation: 8,
                                borderWidth: 1,
                                borderColor: '#374151'
                            }}
                            onPress={() => {
                                mapRef.current?.animateToRegion({
                                    latitude: targetLat!,
                                    longitude: targetLng!,
                                    latitudeDelta: zoomDelta,
                                    longitudeDelta: zoomDelta,
                                }, 1000);
                            }}
                        >
                            <MaterialCommunityIcons name="target" size={20} color="#3B6BB5" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Service Location</Text>
                        </TouchableOpacity>
                    </View>
                </Modal>
            )}
            {/* Agreement Modal */}
            <Modal visible={showAgreementModal} animationType="slide" transparent presentationStyle="overFullScreen">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48 }}>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ backgroundColor: '#FEF3C7', padding: 14, borderRadius: 50, marginBottom: 12 }}>
                                <MaterialCommunityIcons name="shield-alert" size={32} color="#D97706" />
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 6 }}>
                                Before You Start
                            </Text>
                            <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                                Please read and acknowledge the following
                            </Text>
                        </View>

                        <View style={{ backgroundColor: '#FFFBEB', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 24 }}>
                            <Text style={{ fontSize: 15, color: '#92400E', lineHeight: 24, fontWeight: '500' }}>
                                {SHIFT_AGREEMENT_TEXT}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                setShowAgreementModal(false);
                                handleTimerAction('start');
                            }}
                            style={{ backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12, flexDirection: 'row', justifyContent: 'center' }}
                        >
                            <MaterialCommunityIcons name="check-circle" size={22} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '700' }}>I Agree &amp; Start Shift</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowAgreementModal(false)}
                            style={{ paddingVertical: 14, alignItems: 'center' }}
                        >
                            <Text style={{ color: '#6B7280', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}
