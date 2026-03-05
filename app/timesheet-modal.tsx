import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TimesheetModalScreen() {
    const { taskId } = useLocalSearchParams();
    const router = useRouter();

    const [timesheet, setTimesheet] = useState<any>(null);
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetchWithAuth(`/api/mobile/tasks`);
                const json = (await res.json()) as any;

                if (json.success && json.data) {
                    const foundTask = json.data.find((t: any) => String(t.id) === String(taskId));
                    if (foundTask) {
                        setTask(foundTask);
                        // Find the most recently completed timesheet for this task, if any
                        if (foundTask.timesheets && foundTask.timesheets.length > 0) {
                            const completedTimesheets = foundTask.timesheets.filter((ts: any) => ts.end_time && ts.end_time !== "0");
                            if (completedTimesheets.length > 0) {
                                // Default to the last one logged
                                setTimesheet(completedTimesheets[completedTimesheets.length - 1]);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load task timesheet details", err);
            } finally {
                setLoading(false);
            }
        };

        if (taskId) fetchData();
        else setLoading(false);
    }, [taskId]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    if (!timesheet) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB', padding: 24 }}>
                <MaterialCommunityIcons name="timeline-alert-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#4B5563', marginBottom: 8 }}>No Timesheet Found</Text>
                <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
                    We couldn't find a completed timesheet record for this shift.
                </Text>
                <TouchableOpacity style={{ backgroundColor: '#4F46E5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }} onPress={() => router.back()}>
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Close Modal</Text>
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
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Completed Shift Details</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#F3F4F6', padding: 8, borderRadius: 20 }}>
                    <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
                {/* Header Card */}
                <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                        {task?.name || 'Unknown Task'}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                        <MaterialCommunityIcons name="calendar-check" size={18} color="#10B981" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 15, color: '#10B981', fontWeight: '600' }}>
                            Completed on {e.toLocaleDateString()}
                        </Text>
                    </View>

                    <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 2, textTransform: 'uppercase' }}>Duration</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{hours} hours</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: '#D1D5DB', height: '100%', marginHorizontal: 16 }} />
                        <View style={{ flex: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 2, textTransform: 'uppercase' }}>Time</Text>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1} adjustsFontSizeToFit>
                                {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Notes Section */}
                <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Shift Logs & Checklists</Text>
                    <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 150, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}>
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
