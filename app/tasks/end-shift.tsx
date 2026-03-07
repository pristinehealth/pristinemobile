import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Image } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../../lib/api";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SignatureScreen from "react-native-signature-canvas";
import * as Location from 'expo-location';

// Haversine distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const clinicalQuestions = [
    { id: 'q1', section: 'General Observations', text: "Client's overall mood and demeanor.", type: 'text' },
    { id: 'q2', section: 'General Observations', text: "Any noticeable changes in behavior or health status.", type: 'text' },
    { id: 'q3', section: 'General Observations', text: "Level of cooperation and engagement.", type: 'text' },

    { id: 'q4', section: 'Activities and Assistance', text: "Morning routine assistance (e.g., dressing, grooming, toileting).", type: 'text' },
    { id: 'q5', section: 'Activities and Assistance', text: "Meal preparation and feeding (Breakfast, Lunch, Dinner).", type: 'text' },
    { id: 'q6', section: 'Activities and Assistance', text: "Medication administration and any observed side effects.", type: 'text' },
    { id: 'q7', section: 'Activities and Assistance', text: "Engagement in recreational activities.", type: 'text' },

    { id: 'q8', section: 'Health and Vital Signs', text: "Record vital signs (e.g., blood pressure, heart rate, temperature).", type: 'text' },
    { id: 'q9', section: 'Health and Vital Signs', text: "Any signs of pain or discomfort reported by the client.", type: 'text' },

    { id: 'q10', section: 'Safety and Environment', text: "Ensure the home environment is safe and free of hazards.", type: 'text' },
    { id: 'q11', section: 'Safety and Environment', text: "Any equipment malfunctions or issues (e.g., wheelchair, lift).", type: 'boolean_explain' },
    { id: 'q12', section: 'Safety and Environment', text: "Notable changes in home cleanliness or organization.", type: 'boolean_explain' },

    { id: 'q13', section: 'Team Communication', text: "Any updates provided to the family or healthcare professionals.", type: 'boolean_explain' },
    { id: 'q14', section: 'Team Communication', text: "Any concerns or requests from the client or family.", type: 'boolean_explain' },

    { id: 'q15', section: 'Plans for Next Shift', text: "Any specific instructions or preferences for the next caregiver.", type: 'boolean_explain' },
    { id: 'q16', section: 'Plans for Next Shift', text: "Upcoming appointments or activities.", type: 'boolean_explain' },
    { id: 'q17', section: 'Plans for Next Shift', text: "Any anticipated changes in the care plan.", type: 'boolean_explain' },
];

export default function EndShiftScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // State for Checklists and Notes
    const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
    const [dailyNote, setDailyNote] = useState("");

    // State for Clinical Questionnaire
    const [qAnswers, setQAnswers] = useState<Record<string, string>>({});
    const [qBools, setQBools] = useState<Record<string, 'No' | 'Other' | null>>({});

    // State for Signatures
    const [customerSignature, setCustomerSignature] = useState<string | null>(null);
    const [staffSignature, setStaffSignature] = useState<string | null>(null);

    // UI Toggles for Signature Pads
    const [showCustomerSigPad, setShowCustomerSigPad] = useState(false);
    const [showStaffSigPad, setShowStaffSigPad] = useState(false);

    // Off-site clock-out enforcement
    const [offSiteReason, setOffSiteReason] = useState("");
    const [isOutsideFacility, setIsOutsideFacility] = useState(false);
    const [locationChecked, setLocationChecked] = useState(false);

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const res = await fetchWithAuth("/api/mobile/tasks");
                const json = (await res.json()) as any;
                if (json.success && json.data) {
                    const foundTask = json.data.find((t: any) => String(t.id) === String(id));
                    setTask(foundTask);

                    if (foundTask && foundTask.checklist_items) {
                        const defaultState: Record<string, boolean> = {};
                        foundTask.checklist_items.forEach((item: any) => {
                            defaultState[item.id] = (item.finished === "1");
                        });
                        setChecklistState(defaultState);
                    }
                }
            } catch (err) {
                console.error("Failed to load task for end shift", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTask();
    }, [id]);

    // Check GPS position vs facility on mount (non-blocking)
    useEffect(() => {
        const checkLocation = async () => {
            if (!task) return;
            const customFields = task.project_data?.customfields || [];
            const latField = customFields.find((f: any) => f.label?.toLowerCase().includes('latitude'));
            const lngField = customFields.find((f: any) => f.label?.toLowerCase().includes('longitude'));
            const radiusField = customFields.find((f: any) => f.label?.toLowerCase().includes('radius'));
            const targetLat = latField?.value ? parseFloat(latField.value) : null;
            const targetLng = lngField?.value ? parseFloat(lngField.value) : null;
            const allowedRadius = radiusField && !isNaN(parseFloat(radiusField.value)) ? parseFloat(radiusField.value) : 20;

            if (!targetLat || !targetLng) { setLocationChecked(true); return; }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { setLocationChecked(true); return; }

            let loc = await Location.getLastKnownPositionAsync();
            if (!loc) loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
            if (!loc) { setLocationChecked(true); return; }

            const dist = getDistance(loc.coords.latitude, loc.coords.longitude, targetLat, targetLng);
            setIsOutsideFacility(dist > allowedRadius);
            setLocationChecked(true);
        };
        checkLocation();
    }, [task]);

    const toggleChecklist = (itemId: string) => {
        setChecklistState(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    const handleCompleteShift = async () => {
        if (!task) return;

        // Validation pass
        let missing = false;
        clinicalQuestions.forEach(q => {
            if (q.type === 'text') {
                if (!qAnswers[q.id] || qAnswers[q.id].trim() === "") missing = true;
            } else {
                if (!qBools[q.id]) missing = true;
                if (qBools[q.id] === 'Other' && (!qAnswers[q.id] || qAnswers[q.id].trim() === "")) missing = true;
            }
        });

        if (missing) {
            Alert.alert("Incomplete Report", "Please answer all required clinical questions and provide explanations where 'Other/Yes' is selected.");
            return;
        }

        if (isOutsideFacility && offSiteReason.trim() === '') {
            Alert.alert("Off-Site Clock-Out", "You are outside the facility. Please provide a reason for clocking out from this location.");
            return;
        }

        try {
            setSubmitting(true);

            // Compile questionnaire array
            const questionnairePayload = clinicalQuestions.map(q => {
                let ans = "";
                if (q.type === 'text') {
                    ans = qAnswers[q.id];
                } else {
                    if (qBools[q.id] === 'No') ans = "No Issues / None";
                    else ans = `Yes/Reported - ${qAnswers[q.id]}`;
                }
                return { question: q.text, answer: ans };
            });

            const offSiteNote = isOutsideFacility
                ? `[OFF-SITE CLOCK-OUT] Reason: ${offSiteReason.trim()}\n\n`
                : '';

            const payload = {
                task_id: id,
                action: 'stop',
                note: `${offSiteNote}${dailyNote}`,
                checklist_items: task.checklist_items?.map((item: any) => ({
                    id: item.id,
                    description: item.description,
                    finished: checklistState[item.id] ? "1" : "0"
                })) || [],
                questionnaire: questionnairePayload,
                customer_signature: customerSignature,
                staff_signature: staffSignature
            };

            const res = await fetchWithAuth("/api/mobile/timesheets/action", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = (await res.json()) as any;
            if (res.ok && json.success) {
                Alert.alert("Shift Completed", "Timesheet successfully submitted to Perfex!");
                router.replace('/(tabs)');
            } else {
                throw new Error(json.error || "Failed to complete shift");
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#F9FAFB' }}>
                <ActivityIndicator size="large" color="#3B6BB5" />
            </View>
        );
    }

    // Grouping questions for rendering
    const sections = Array.from(new Set(clinicalQuestions.map(curr => curr.section)));

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            <ScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            >

                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                        Shift Wrap-Up
                    </Text>
                    <Text style={{ fontSize: 16, color: '#4B5563', lineHeight: 22 }}>
                        Please complete the mandatory clinical report, checklists, and provide daily shift notes before closing out.
                    </Text>
                </View>

                {/* Checklist Section */}
                {task?.checklist_items && task.checklist_items.length > 0 && (
                    <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Task Checklist
                        </Text>
                        {task.checklist_items.map((item: any, idx: number) => {
                            const isChecked = checklistState[item.id] === true;
                            return (
                                <TouchableOpacity
                                    key={`cl-${item.id}`}
                                    onPress={() => toggleChecklist(item.id)}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingVertical: 12,
                                        borderTopWidth: idx === 0 ? 0 : 1,
                                        borderTopColor: '#F3F4F6'
                                    }}
                                >
                                    <MaterialCommunityIcons
                                        name={isChecked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                                        size={28}
                                        color={isChecked ? "#10B981" : "#D1D5DB"}
                                        style={{ marginRight: 12 }}
                                    />
                                    <Text style={{ fontSize: 16, color: isChecked ? '#6B7280' : '#111827', flex: 1 }}>{item.description}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                )}

                {/* Questionnaire Section */}
                {sections.map(sec => (
                    <View key={sec} style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 }}>{sec}</Text>

                        {clinicalQuestions.filter(q => q.section === sec).map(q => (
                            <View key={q.id} style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
                                    {q.text} <Text style={{ color: '#EF4444' }}>*</Text>
                                </Text>

                                {q.type === 'text' ? (
                                    <TextInput
                                        style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, minHeight: 80, fontSize: 15, color: '#111827', textAlignVertical: 'top' }}
                                        multiline
                                        placeholder="Enter details..."
                                        placeholderTextColor="#9CA3AF"
                                        value={qAnswers[q.id] || ''}
                                        onChangeText={txt => setQAnswers(prev => ({ ...prev, [q.id]: txt }))}
                                    />
                                ) : (
                                    <View>
                                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                                            <TouchableOpacity
                                                style={{ flex: 1, backgroundColor: qBools[q.id] === 'No' ? '#EEF3FB' : '#F9FAFB', borderWidth: 1, borderColor: qBools[q.id] === 'No' ? '#3B6BB5' : '#E5E7EB', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                                                onPress={() => setQBools(prev => ({ ...prev, [q.id]: 'No' }))}
                                            >
                                                <Text style={{ fontWeight: '600', color: qBools[q.id] === 'No' ? '#3B6BB5' : '#4B5563' }}>No / None</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={{ flex: 1, backgroundColor: qBools[q.id] === 'Other' ? '#FEF2F2' : '#F9FAFB', borderWidth: 1, borderColor: qBools[q.id] === 'Other' ? '#EF4444' : '#E5E7EB', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                                                onPress={() => setQBools(prev => ({ ...prev, [q.id]: 'Other' }))}
                                            >
                                                <Text style={{ fontWeight: '600', color: qBools[q.id] === 'Other' ? '#EF4444' : '#4B5563' }}>Yes / Other</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {qBools[q.id] === 'Other' && (
                                            <TextInput
                                                style={{ backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, minHeight: 60, fontSize: 15, color: '#111827', textAlignVertical: 'top', marginTop: 8 }}
                                                multiline
                                                placeholder="Please explain in detail..."
                                                placeholderTextColor="#9CA3AF"
                                                value={qAnswers[q.id] || ''}
                                                onChangeText={txt => setQAnswers(prev => ({ ...prev, [q.id]: txt }))}
                                            />
                                        )}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                ))}

                {/* Off-Site Clock-Out Warning */}
                {locationChecked && isOutsideFacility && (
                    <View style={{ backgroundColor: '#FEF2F2', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1.5, borderColor: '#FCA5A5' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <MaterialCommunityIcons name="map-marker-alert" size={24} color="#DC2626" style={{ marginRight: 10 }} />
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#DC2626', flex: 1 }}>
                                Off-Site Clock-Out Detected
                            </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: '#7F1D1D', lineHeight: 20, marginBottom: 16 }}>
                            Your location is outside the facility's approved zone. A reason is required to complete your clock-out.
                        </Text>
                        <TextInput
                            style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, padding: 12, minHeight: 80, fontSize: 15, color: '#111827', textAlignVertical: 'top' }}
                            multiline
                            placeholder="Explain why you are clocking out away from the facility... (required)"
                            placeholderTextColor="#EF4444"
                            value={offSiteReason}
                            onChangeText={setOffSiteReason}
                        />
                    </View>
                )}

                {/* Daily Note Area */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 }}>Additional Notes</Text>
                    <TextInput
                        style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, minHeight: 120, fontSize: 16, color: '#111827', textAlignVertical: 'top' }}
                        multiline
                        placeholder="Any other issues, observations, or summary points here..."
                        placeholderTextColor="#9CA3AF"
                        value={dailyNote}
                        onChangeText={setDailyNote}
                    />
                </View>

                {/* Signatures Area */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 }}>Optional Signatures</Text>

                    {/* CLIENT SIGNATURE ROW */}
                    <View style={{ marginBottom: 16 }}>
                        <TouchableOpacity
                            onPress={() => setShowCustomerSigPad(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: customerSignature ? '#10B981' : '#E5E7EB', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                {customerSignature ? (
                                    <View style={{ width: 60, height: 40, backgroundColor: '#F9FAFB', borderRadius: 8, marginRight: 16, borderWidth: 1, borderColor: '#10B981', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                                        <Image source={{ uri: customerSignature }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                                    </View>
                                ) : (
                                    <MaterialCommunityIcons name="draw-pen" size={26} color="#3B6BB5" style={{ marginRight: 16 }} />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Client Signature</Text>
                                    <Text style={{ fontSize: 13, color: customerSignature ? '#10B981' : '#6B7280', marginTop: 2 }}>{customerSignature ? 'Signature Saved. Tap to redo.' : 'Tap to open drawing pad'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    {/* CAREGIVER SIGNATURE ROW */}
                    <View style={{ marginBottom: 16 }}>
                        <TouchableOpacity
                            onPress={() => setShowStaffSigPad(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: staffSignature ? '#10B981' : '#E5E7EB', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                {staffSignature ? (
                                    <View style={{ width: 60, height: 40, backgroundColor: '#F9FAFB', borderRadius: 8, marginRight: 16, borderWidth: 1, borderColor: '#10B981', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                                        <Image source={{ uri: staffSignature }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                                    </View>
                                ) : (
                                    <MaterialCommunityIcons name="draw-pen" size={26} color="#3B6BB5" style={{ marginRight: 16 }} />
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Caregiver Signature</Text>
                                    <Text style={{ fontSize: 13, color: staffSignature ? '#10B981' : '#6B7280', marginTop: 2 }}>{staffSignature ? 'Signature Saved. Tap to redo.' : 'Tap to open drawing pad'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Complete Button */}
                <TouchableOpacity
                    onPress={handleCompleteShift}
                    disabled={submitting}
                    style={{ backgroundColor: '#EF4444', paddingVertical: 18, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 4, shadowColor: '#EF4444', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 }}
                >
                    {submitting ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <MaterialCommunityIcons name="check-circle" size={24} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Submit & Stop Timer</Text>
                        </>
                    )}
                </TouchableOpacity>

            </ScrollView>

            {/* CUSTOMER SIGNATURE MODAL */}
            <Modal visible={showCustomerSigPad} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCustomerSigPad(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                        <TouchableOpacity onPress={() => setShowCustomerSigPad(false)} style={{ padding: 8 }}>
                            <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={{ color: '#111827', fontSize: 18, fontWeight: '700' }}>Client Signature</Text>
                        <View style={{ width: 60 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <SignatureScreen
                            onOK={(sig) => {
                                setCustomerSignature(sig);
                                setShowCustomerSigPad(false);
                            }}
                            onEmpty={() => console.log("Empty")}
                            descriptionText="Client Signature"
                            clearText="Clear Drawing"
                            confirmText="Save Signature"
                            autoClear={false}
                            minWidth={1}
                            maxWidth={4}
                            dotSize={2}
                            penColor="#111827"
                            webStyle={`
                                body { display: flex; flex-direction: column; height: 100vh; margin: 0; padding: 0; }
                                .m-signature-pad { flex: 1; display: flex; flex-direction: column; box-shadow: none; border: none; margin: 0; }
                                .m-signature-pad--body { flex: 1; position: relative; }
                                .m-signature-pad--body canvas { touch-action: none; position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
                                .m-signature-pad--footer { display: flex !important; justify-content: space-between; padding: 20px; align-items: center; background: #ffffff; border-top: 1px solid #E5E7EB; }
                                .m-signature-pad--footer .description { display: none; }
                                .button { padding: 14px 24px; font-size: 16px; font-weight: 700; border-radius: 8px; border: none; }
                                .button.clear { background-color: #FEE2E2; color: #DC2626; }
                                .button.save { background-color: #10B981; color: #ffffff; }
                            `}
                        />
                    </View>
                </SafeAreaView>
            </Modal>

            {/* CAREGIVER SIGNATURE MODAL */}
            <Modal visible={showStaffSigPad} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStaffSigPad(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                        <TouchableOpacity onPress={() => setShowStaffSigPad(false)} style={{ padding: 8 }}>
                            <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={{ color: '#111827', fontSize: 18, fontWeight: '700' }}>Caregiver Signature</Text>
                        <View style={{ width: 60 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <SignatureScreen
                            onOK={(sig) => {
                                setStaffSignature(sig);
                                setShowStaffSigPad(false);
                            }}
                            onEmpty={() => console.log("Empty")}
                            descriptionText="Caregiver Signature"
                            clearText="Clear Drawing"
                            confirmText="Save Signature"
                            autoClear={false}
                            minWidth={1}
                            maxWidth={4}
                            dotSize={2}
                            penColor="#111827"
                            webStyle={`
                                body { display: flex; flex-direction: column; height: 100vh; margin: 0; padding: 0; }
                                .m-signature-pad { flex: 1; display: flex; flex-direction: column; box-shadow: none; border: none; margin: 0; }
                                .m-signature-pad--body { flex: 1; position: relative; }
                                .m-signature-pad--body canvas { touch-action: none; position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
                                .m-signature-pad--footer { display: flex !important; justify-content: space-between; padding: 20px; align-items: center; background: #ffffff; border-top: 1px solid #E5E7EB; }
                                .m-signature-pad--footer .description { display: none; }
                                .button { padding: 14px 24px; font-size: 16px; font-weight: 700; border-radius: 8px; border: none; }
                                .button.clear { background-color: #FEE2E2; color: #DC2626; }
                                .button.save { background-color: #10B981; color: #ffffff; }
                            `}
                        />
                    </View>
                </SafeAreaView>
            </Modal>

        </KeyboardAvoidingView >
    );
}
