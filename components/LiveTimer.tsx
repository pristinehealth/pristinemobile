import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface LiveTimerProps {
    startTimeUnix: number; // The unix timestamp in seconds when the timer started
}

export default function LiveTimer({ startTimeUnix }: LiveTimerProps) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        // Check every second
        const intervalId = setInterval(() => {
            const nowUnix = Math.floor(Date.now() / 1000);
            const diff = Math.max(0, nowUnix - startTimeUnix);
            setElapsedSeconds(diff);
        }, 1000);

        // Initial calculation so there's no 1-second delay
        const initialDiff = Math.max(0, Math.floor(Date.now() / 1000) - startTimeUnix);
        setElapsedSeconds(initialDiff);

        return () => clearInterval(intervalId);
    }, [startTimeUnix]);

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        // Pad to 2 digits
        const pad = (num: number) => num.toString().padStart(2, '0');

        if (h > 0) {
            return `${pad(h)}:${pad(m)}:${pad(s)}`;
        }
        return `${pad(m)}:${pad(s)}`;
    };

    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '800',
        fontVariant: ['tabular-nums'], // keeps the numbers from shifting horizontally
    }
});
