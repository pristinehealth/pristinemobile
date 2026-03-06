import React from "react";
import { Tabs } from "expo-router";
import { useColorScheme, TouchableOpacity, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../_layout";

export default function TabLayout() {
  const scheme = useColorScheme();
  const activeColor = '#F0A030'; // Pristine Health brand orange (accent)
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of Pristine Staffing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
          }
        }
      ]
    );
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        headerShown: true, // We will show it natively now
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: '#3B6BB5', // Theme color
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '700',
        },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16, padding: 8 }}>
            <MaterialCommunityIcons name="logout-variant" size={24} color="#ffffff" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: "My Shifts",
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard" size={26} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="timesheets"
        options={{
          headerTitle: "Timesheet Ledger",
          title: "Timesheets",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="clock-outline" size={26} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: "My Profile",
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account-circle" size={26} color={color} />
          )
        }}
      />
    </Tabs>
  );
}