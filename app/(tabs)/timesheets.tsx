import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TimesheetsScreen() {
    const [timesheets, setTimesheets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Pagination State
    const [startIdx, setStartIdx] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [fetchingMore, setFetchingMore] = useState(false);
    const LENGTH = 25;

    const router = useRouter();

    const fetchAllData = async (isRefresh = false, currentStart = 0) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else if (currentStart > 0) {
                setFetchingMore(true);
            } else {
                setLoading(true);
            }

            const res = await fetchWithAuth(`/api/mobile/timesheets?start=${currentStart}&length=${LENGTH}`);
            const json = (await res.json()) as any;

            if (json.success && json.data) {
                let newTs;
                if (currentStart === 0 || isRefresh) {
                    newTs = json.data;
                } else {
                    newTs = [...timesheets, ...json.data];
                }

                setTimesheets(newTs);
                setStartIdx(currentStart + LENGTH);

                if (json.meta && json.meta.total) {
                    setHasMore(newTs.length < json.meta.total);
                } else {
                    setHasMore(json.data.length === LENGTH);
                }
            }
        } catch (err) {
            console.error("Failed to load timesheets", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setFetchingMore(false);
        }
    };

    useEffect(() => {
        fetchAllData(false, 0);
    }, []);

    const onRefresh = () => {
        setHasMore(true);
        fetchAllData(true, 0);
    };

    const handleLoadMore = () => {
        if (!hasMore || fetchingMore || loading || refreshing) return;
        fetchAllData(false, startIdx);
    };

    const renderItem = ({ item: ts }: { item: any }) => {
        const isUnixS = /^\d+$/.test(String(ts.start_time));
        const isUnixE = /^\d+$/.test(String(ts.end_time));
        const s = isUnixS ? new Date(parseInt(ts.start_time) * 1000) : new Date(String(ts.start_time).replace(' ', 'T'));
        const e = isUnixE ? new Date(parseInt(ts.end_time) * 1000) : new Date(String(ts.end_time).replace(' ', 'T'));
        const hours = ((e.getTime() - s.getTime()) / (1000 * 3600)).toFixed(2);

        return (
            <TouchableOpacity
                onPress={() => router.push(`/timesheets/${ts.id}`)}
                style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 }} numberOfLines={1}>
                            {ts.task_name || 'Unknown Shift'}
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' }}>
                            {s.toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={{ backgroundColor: '#EEF2FF', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 12 }}>
                        <Text style={{ color: '#4F46E5', fontWeight: '800', fontSize: 16 }}>{hours}h</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' }}>
                    <MaterialCommunityIcons name="clock-start" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>
                            {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <Stack.Screen options={{ title: "Timesheets" }} />

            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                    My Timesheets
                </Text>
                <Text style={{ fontSize: 16, color: '#6B7280' }}>
                    Your complete history of logged shifts and durations.
                </Text>
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                </View>
            ) : (
                <FlatList
                    data={timesheets}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
                    }
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        fetchingMore ? (
                            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color="#4F46E5" />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={{ backgroundColor: '#ffffff', padding: 32, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', marginTop: 12 }}>
                            <MaterialCommunityIcons name="clock-outline" size={48} color="#D1D5DB" style={{ marginBottom: 16 }} />
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#9CA3AF', marginBottom: 8 }}>No Timesheets Found</Text>
                            <Text style={{ fontSize: 15, color: '#9CA3AF', textAlign: 'center' }}>
                                You have not completed any shifts yet.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
