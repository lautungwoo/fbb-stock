import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('请输入邮箱和密码');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
    // If successful, onAuthStateChange in AuthContext will handle navigation automatically
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19] justify-center items-center">
      <View className="w-full max-w-sm px-6 py-8 bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl">
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-indigo-600 rounded-2xl items-center justify-center border border-indigo-400/30 mb-4">
            <Ionicons name="cube" size={32} color="white" />
          </View>
          <Text className="text-white text-2xl font-extrabold tracking-tight">Fuufoo Stock App</Text>
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Supply Chain Hub Login</Text>
        </View>

        {errorMsg ? (
          <View className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl mb-4">
            <Text className="text-red-400 text-xs text-center">{errorMsg}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Text className="text-slate-400 text-xs font-bold mb-2 ml-1">EMAIL ADDRESS</Text>
          <TextInput
            className="w-full bg-[#020617] border border-slate-800 text-white px-4 py-3 rounded-xl"
            placeholder="name@fuufoonbites.com"
            placeholderTextColor="#475569"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </View>

        <View className="mb-8">
          <Text className="text-slate-400 text-xs font-bold mb-2 ml-1">PASSWORD</Text>
          <TextInput
            className="w-full bg-[#020617] border border-slate-800 text-white px-4 py-3 rounded-xl"
            placeholder="••••••••"
            placeholderTextColor="#475569"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
        </View>

        <TouchableOpacity 
          className={`w-full py-4 rounded-xl items-center justify-center ${loading ? 'bg-indigo-600/50' : 'bg-indigo-600'}`}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-sm">Secure Login</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
