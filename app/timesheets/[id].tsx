import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TimesheetDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [timesheet, setTimesheet] = useState<any>(null);
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch the timesheet slice. 
                // Note: Realistically, we should make a `/api/mobile/timesheets/[id]` endpoint for O(1) fetching,
                // but since the mobile app keeps a local cache in the paginated list, fetching the top page generally works 
                // for immediate drill-downs. For robustness, we will hit the global sync-backed Tasks list if we must.

                // Fetch the specific task that owns this timesheet to get its full data
                const res = await fetchWithAuth(`/api/mobile/tasks`);
                const json = (await res.json()) as any;

                if (json.success && json.data) {
                    let foundTs = null;
                    let foundTask = null;

                    for (const t of json.data) {
                        if (t.timesheets && t.timesheets.length > 0) {
                            const ts = t.timesheets.find((ts: any) => String(ts.id) === String(id));
                            if (ts) {
                                foundTs = ts;
                                foundTask = t;
                                break;
                            }
                        }
                    }

                    setTimesheet(foundTs);
                    setTask(foundTask);
                }
            } catch (err) {
                console.error("Failed to load timesheet details", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <Stack.Screen options={{ title: "Loading..." }} />
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    if (!timesheet) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <Stack.Screen options={{ title: "Not Found" }} />
                <Text style={{ fontSize: 18, color: '#6B7280' }}>Timesheet not found.</Text>
                <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
                    <Text style={{ color: '#4F46E5', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isUnixS = /^\d+$/.test(String(timesheet.start_time));
    const isUnixE = /^\d+$/.test(String(timesheet.end_time));
    const s = isUnixS ? new Date(parseInt(timesheet.start_time) * 1000) : new Date(String(timesheet.start_time).replace(' ', 'T'));
    const e = isUnixE ? new Date(parseInt(timesheet.end_time) * 1000) : new Date(String(timesheet.end_time).replace(' ', 'T'));
    const hours = ((e.getTime() - s.getTime()) / (1000 * 3600)).toFixed(2);

    return (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <Stack.Screen options={{ title: "Shift Details", headerBackTitle: "Back" }} />

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>

                {/* Header Card */}
                <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                        {task?.name || 'Unknown Task'}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <MaterialCommunityIcons name="calendar" size={18} color="#6B7280" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 15, color: '#4B5563', fontWeight: '500' }}>
                            {s.toLocaleDateString()}
                        </Text>
                    </View>

                    <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 2, textTransform: 'uppercase' }}>Duration</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{hours} hours</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: '#D1D5DB', height: '100%' }} />
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 2, textTransform: 'uppercase' }}>Time</Text>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                                {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Notes Section */}
                <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Shift Logs & Checklists</Text>
                    <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 150 }}>
                        {timesheet.note ? (
                            <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 24 }}>
                                {timesheet.note}
                            </Text>
                        ) : (
                            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 20 }}>
                                <MaterialCommunityIcons name="note-text-outline" size={32} color="#D1D5DB" style={{ marginBottom: 8 }} />
                                <Text style={{ color: '#9CA3AF', fontSize: 15 }}>No notes were provided for this shift.</Text>
                            </View>
                        )}
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}
