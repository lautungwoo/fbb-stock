import { Slot } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import LoginScreen from "../components/LoginScreen";
import "./global.css";

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 bg-[#0b0f19] justify-center items-center">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
