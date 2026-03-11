import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, ScrollView, Animated } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useFocusEffect } from 'expo-router';
import { fetchWithAuth } from "../../lib/api";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getSocket, joinStaffRoom } from '../../lib/socket';

type FilterType = 'All' | 'Today' | 'Upcoming' | 'Completed';

export default function HomeTab() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination State
  const [startIdx, setStartIdx] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const LENGTH = 25;

  // Filter State
  const [activeFilter, setActiveFilter] = useState<FilterType>('Today');
  const [counts, setCounts] = useState({ all: 0, today: 0, upcoming: 0, completed: 0 });

  const router = useRouter();

  // ── Real-time socket listener ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const handler = () => {
      if (!active) return;
      console.log('[Socket.IO] shift event received — refreshing tasks');
      loadTasks(true, 0);
    };
    (async () => {
      await joinStaffRoom();
      const socket = getSocket();
      if (!socket || !active) return;
      socket.on('shift:ended', handler);
      socket.on('shift:started', handler);   // ← refresh on start too
    })();
    return () => {
      active = false;
      getSocket()?.off('shift:ended', handler);
      getSocket()?.off('shift:started', handler);
    };
  }, []);

  // ── Refresh whenever the tab comes back into focus ─────────────────────
  // Catches status changes from starting/ending a shift on the detail screen.
  useFocusEffect(
    useCallback(() => {
      loadTasks(true, 0);
    }, [])
  );
  // ──────────────────────────────────────────────────────────────────────────

  // Helper: detect if a task has an open (unended) timesheet
  const taskHasActiveShift = (t: any): boolean =>
    (t.timesheets || []).some(
      (ts: any) => ts.end_time === null || ts.end_time === '0' || ts.end_time === ''
    );

  const loadTasks = async (isRefresh = false, currentStart = 0) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (currentStart > 0) {
        setFetchingMore(true);
      } else {
        setLoading(true);
      }

      const res = await fetchWithAuth(`/api/mobile/tasks?start=${currentStart}&length=${LENGTH}`);
      const json = (await res.json()) as any;

      if (json.success && json.data) {
        let newTasks;
        if (currentStart === 0 || isRefresh) {
          newTasks = json.data;
        } else {
          const existingIds = new Set(tasks.map((t: any) => String(t.id)));
          const fresh = json.data.filter((t: any) => !existingIds.has(String(t.id)));
          newTasks = [...tasks, ...fresh];
        }

        setTasks(newTasks);
        setStartIdx(currentStart + LENGTH);

        if (json.meta && json.meta.total) {
          setHasMore(newTasks.length < json.meta.total);
        } else {
          setHasMore(json.data.length === LENGTH);
        }

        // ── Counts calculation — tasks with an open timesheet always count as Today ──
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        let cToday = 0, cUpcoming = 0, cCompleted = 0;

        newTasks.forEach((t: any) => {
          const hasActive = taskHasActiveShift(t);
          if (t.status === "5") {
            cCompleted++;
          } else if (t.status === "4" || hasActive) {
            // In Progress or has open timesheet → always Today
            cToday++;
          } else if (!t.startdate || t.startdate === '0000-00-00') {
            cUpcoming++;
          } else if (t.startdate.split(' ')[0] === todayStr) {
            cToday++;
          } else {
            cUpcoming++;
          }
        });

        setCounts({
          all: newTasks.length,
          today: cToday,
          upcoming: cUpcoming,
          completed: cCompleted
        });
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
      if (currentStart === 0 || isRefresh) {
        setTasks([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFetchingMore(false);
    }
  };

  useEffect(() => {
    loadTasks(false, 0);
  }, []);

  const onRefresh = () => {
    setHasMore(true);
    loadTasks(true, 0);
  };

  const handleLoadMore = () => {
    if (!hasMore || fetchingMore || loading || refreshing) return;
    loadTasks(false, startIdx);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '1': return { bg: '#FEF2F2', text: '#DC2626', label: 'Not Started' };
      case '2': return { bg: '#EFF6FF', text: '#2563EB', label: 'Awaiting Feedback' };
      case '3': return { bg: '#F8FAFC', text: '#64748B', label: 'Testing' };
      case '4': return { bg: '#ECFCCB', text: '#65A30D', label: 'In Progress' };
      case '5': return { bg: '#ECFDF5', text: '#059669', label: 'Complete' };
      default: return { bg: '#F3F4F6', text: '#4B5563', label: 'Unknown' };
    }
  };

  // ── Active shift banner ──────────────────────────────────────────
  const activeShiftTask = tasks.find((t) => t.status !== '5' && taskHasActiveShift(t));

  // Derive the unix start_time from the open timesheet so we can show a live elapsed timer
  const activeTimesheetEntry = activeShiftTask
    ? (activeShiftTask.timesheets || []).find(
      (ts: any) => ts.end_time === null || ts.end_time === '0' || ts.end_time === ''
    )
    : null;
  const activeStartTimeUnix = activeTimesheetEntry
    ? (/^\d+$/.test(String(activeTimesheetEntry.start_time))
      ? parseInt(activeTimesheetEntry.start_time)
      : Math.floor(new Date(String(activeTimesheetEntry.start_time).replace(' ', 'T')).getTime() / 1000))
    : null;
  // ──────────────────────────────────────────────────────────

  // Compute purely filtered list for UI rendering
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Completed') return t.status === "5";

    const hasActive = taskHasActiveShift(t);

    if (activeFilter === 'Today') {
      // In Progress OR has an open timesheet (regardless of scheduled date) OR scheduled today
      return t.status !== "5" && (
        t.status === '4' ||
        hasActive ||
        (t.startdate && t.startdate !== '0000-00-00' && t.startdate.split(' ')[0] === todayStr)
      );
    }
    if (activeFilter === 'Upcoming') {
      // Only Not Started tasks with no open timesheet that aren't today
      return t.status === '1' && !hasActive && (
        !t.startdate || t.startdate === '0000-00-00' || t.startdate.split(' ')[0] !== todayStr
      );
    }
    return true;
  }).sort((a, b) => {
    if (activeFilter === 'Completed') {
      const getCompletionDateStr = (task: any) => {
        if (task.datefinished) return task.datefinished;
        if (task.timesheets && task.timesheets.length > 0) {
          const maxEnd = Math.max(...task.timesheets.map((ts: any) => parseInt(ts.end_time || "0")));
          if (maxEnd > 0) return new Date(maxEnd * 1000).toISOString().replace('T', ' ').split('.')[0];
        }
        return task.startdate || '';
      };
      return getCompletionDateStr(b).localeCompare(getCompletionDateStr(a));
    }

    // Upcoming / Today / All — soonest startdate first, undated tasks go to the end
    const aDate = a.startdate && a.startdate !== '0000-00-00' ? a.startdate : '9999-99-99';
    const bDate = b.startdate && b.startdate !== '0000-00-00' ? b.startdate : '9999-99-99';
    return aDate.localeCompare(bDate);
  });

  const renderItem = ({ item }: { item: any }) => {
    const statusConfig = getStatusColor(item.status);

    return (
      <TouchableOpacity
        onPress={() => item.status === "5" ? router.push(`/timesheet-modal?taskId=${item.id}`) : router.push(`/tasks/${item.id}`)}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          marginHorizontal: 20,
          borderWidth: 1,
          borderColor: '#F3F4F6',
          elevation: 2,
          shadowColor: '#111827',
          shadowOpacity: 0.04,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
              {item.name}
            </Text>
            {item.project_data && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="office-building" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 14, color: '#6B7280' }}>
                  {item.project_data.name || "Unknown Project"}
                </Text>
              </View>
            )}
            {item.project_data?.extracted_address && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 14, color: '#6B7280' }}>
                  {item.project_data.extracted_address}
                  {item.project_data.extracted_city ? `, ${item.project_data.extracted_city}` : ''}
                </Text>
              </View>
            )}
          </View>
          <View style={{
            backgroundColor: statusConfig.bg,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
          }}>
            <Text style={{ color: statusConfig.text, fontSize: 12, fontWeight: '600' }}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            <MaterialCommunityIcons name="calendar-clock" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
            {(() => {
              if (item.status === '5') {
                if (item.datefinished) {
                  const parts = item.datefinished.split(/[ \-T:]/);
                  const dDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
                  return <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>{`Completed ${dDate.toLocaleDateString()}`}</Text>;
                } else if (item.timesheets && item.timesheets.length > 0) {
                  const maxEnd = Math.max(...item.timesheets.map((ts: any) => parseInt(ts.end_time || "0")));
                  if (maxEnd > 0) {
                    return <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>{`Completed ${new Date(maxEnd * 1000).toLocaleDateString()}`}</Text>;
                  }
                }
                return <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>Completed</Text>;
              }

              if (item.startdate && item.startdate !== "0000-00-00") {
                const parts = item.startdate.split(/[ \-T:]/);
                const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);

                const nowD = new Date();
                nowD.setHours(0, 0, 0, 0);
                const targetMidnight = new Date(targetDate);
                targetMidnight.setHours(0, 0, 0, 0);

                const diffTime = targetMidnight.getTime() - nowD.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                const dateString = targetDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

                if (diffDays === 0) {
                  return <Text style={{ fontSize: 14, color: '#059669', fontWeight: '800' }}>Today ({dateString})</Text>;
                } else if (diffDays === 1) {
                  return <Text style={{ fontSize: 14, color: '#EA580C', fontWeight: '800' }}>Tomorrow ({dateString})</Text>;
                } else if (diffDays > 1 && diffDays <= 3) {
                  return <Text style={{ fontSize: 14, color: '#EA580C', fontWeight: '800' }}>Coming Soon ({dateString})</Text>;
                } else if (diffDays > 3) {
                  return <Text style={{ fontSize: 14, color: '#d39920', fontWeight: '600' }}>{dateString}</Text>;
                } else if (diffDays < 0) {
                  return <Text style={{ fontSize: 14, color: '#EF4444', fontWeight: '800' }}>Past Due ({dateString})</Text>;
                }

                return <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>{dateString}</Text>;
              }

              return <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>No Date</Text>;
            })()}
          </View>

          {item.priority && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="flag-variant" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 14, color: '#4B5563', fontWeight: '500' }}>
                Priority {item.priority}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const FilterPill = ({ label, count, filterKey }: { label: string, count: number, filterKey: FilterType }) => {
    const isActive = activeFilter === filterKey;
    return (
      <TouchableOpacity
        onPress={() => setActiveFilter(filterKey)}
        style={{
          backgroundColor: isActive ? '#3B6BB5' : '#ffffff',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          marginRight: 8,
          borderWidth: 1,
          borderColor: isActive ? '#3B6BB5' : '#E5E7EB',
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <Text style={{ color: isActive ? '#ffffff' : '#4B5563', fontWeight: '600', fontSize: 14, marginRight: 6 }}>
          {label}
        </Text>
        <View style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
          <Text style={{ color: isActive ? '#ffffff' : '#6B7280', fontSize: 12, fontWeight: '700' }}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    )
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>

      {/* ── Active Shift Card ─────────────────────────────────────── */}
      {activeShiftTask && (() => {
        // Pulsing dot animation
        const pulseAnim = new Animated.Value(1);
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ).start();

        // Inline elapsed timer
        const ElapsedTimer = () => {
          const [elapsed, setElapsed] = useState(0);
          useEffect(() => {
            if (!activeStartTimeUnix) return;
            const initial = Math.max(0, Math.floor(Date.now() / 1000) - activeStartTimeUnix);
            setElapsed(initial);
            const id = setInterval(() => {
              setElapsed(Math.max(0, Math.floor(Date.now() / 1000) - activeStartTimeUnix!));
            }, 1000);
            return () => clearInterval(id);
          }, []);
          const h = Math.floor(elapsed / 3600);
          const m = Math.floor((elapsed % 3600) / 60);
          const s = elapsed % 60;
          const p = (n: number) => n.toString().padStart(2, '0');
          return (
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', fontVariant: ['tabular-nums'], letterSpacing: 1 }}>
              {h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`}
            </Text>
          );
        };

        return (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => router.push(`/tasks/${activeShiftTask.id}`)}
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              marginBottom: 4,
              backgroundColor: '#0F2027',
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: '#1E3A2F',
              shadowColor: '#10B981',
              shadowOpacity: 0.25,
              shadowOffset: { width: 0, height: 6 },
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {/* Top row: live dot + SHIFT IN PROGRESS label + timer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              {/* Pulsing dot */}
              <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <View style={{ position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#10B981', opacity: 0.2 }} />
                <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', opacity: pulseAnim }} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', letterSpacing: 2, textTransform: 'uppercase', flex: 1 }}>
                Shift in Progress
              </Text>
              {/* Elapsed timer */}
              {activeStartTimeUnix ? <ElapsedTimer /> : (
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#6B7280' }}>--:--</Text>
              )}
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: '#1E3A2F', marginBottom: 14 }} />

            {/* Task info */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#F9FAFB', marginBottom: 4 }} numberOfLines={1}>
                {activeShiftTask.name}
              </Text>
              {activeShiftTask.project_data?.name && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="office-building-outline" size={13} color="#6B7280" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 13, color: '#9CA3AF' }} numberOfLines={1}>
                    {activeShiftTask.project_data.name}
                  </Text>
                </View>
              )}
              {activeShiftTask.project_data?.extracted_address ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <MaterialCommunityIcons name="map-marker-outline" size={13} color="#6B7280" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 13, color: '#9CA3AF' }} numberOfLines={1}>
                    {activeShiftTask.project_data.extracted_address}
                    {activeShiftTask.project_data.extracted_city ? `, ${activeShiftTask.project_data.extracted_city}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* CTA */}
            <View style={{
              backgroundColor: '#EF4444',
              borderRadius: 12,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialCommunityIcons name="stop-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>End Shift</Text>
            </View>
          </TouchableOpacity>
        );
      })()}
      {/* ───────────────────────────────────────────────────────────── */}

      {/* Horizontal Filter Bar */}
      <View style={{ backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <FilterPill label="Today" count={counts.today} filterKey="Today" />
          <FilterPill label="Upcoming" count={counts.upcoming} filterKey="Upcoming" />
          <FilterPill label="Completed" count={counts.completed} filterKey="Completed" />
          <FilterPill label="All" count={counts.all} filterKey="All" />
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#3B6BB5" />
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item, index) => `task-${String(item.id)}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B6BB5" />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            fetchingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#3B6BB5" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 100 }}>
              <View style={{ backgroundColor: '#EEF3FB', padding: 24, borderRadius: 100, marginBottom: 20 }}>
                <MaterialCommunityIcons name="calendar-check" size={48} color="#3B6BB5" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                No Shifts Found
              </Text>
              <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40 }}>
                There are no assigned shifts matching this filter category.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}