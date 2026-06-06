import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface Transfer {
  id: string;
  product_id?: string;
  item_name: string;
  quantity: number;
  from_location: string;
  to_location: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  created_at: string;
}

interface DispatchComponentProps {
  onDispatchSuccess?: () => void;
}

export default function DispatchComponent({ onDispatchSuccess }: DispatchComponentProps) {
  const [pendingTransfers, setPendingTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch pending transfers from Supabase
  const fetchPendingTransfers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_transfers')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingTransfers(data || []);
      // Auto-select the first one if available
      if (data && data.length > 0 && !selectedTransfer) {
        setSelectedTransfer(data[0]);
      }
    } catch (err: any) {
      console.error("Error fetching transfers:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransfers();
  }, []);

  const handleDispatch = async (minutes: number) => {
    if (!selectedTransfer) return;

    setSubmitting(true);
    const now = new Date();
    const dispatchedAt = now.toISOString();
    const estimatedArrivalAt = new Date(now.getTime() + minutes * 60 * 1000).toISOString();

    try {
      const { error } = await supabase
        .from('inventory_transfers')
        .update({
          status: 'in_transit',
          dispatched_at: dispatchedAt,
          estimated_arrival_at: estimatedArrivalAt
        })
        .eq('id', selectedTransfer.id);

      if (error) throw error;

      Alert.alert(
        "Dispatched Successfully",
        `[${selectedTransfer.item_name}] is now in transit!\nETA: +${minutes} minutes.`
      );

      setSelectedTransfer(null);
      await fetchPendingTransfers();
      if (onDispatchSuccess) onDispatchSuccess();
    } catch (err: any) {
      Alert.alert("Dispatch Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-900/60 p-6 rounded-[32px] border border-slate-800 backdrop-blur-md">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-indigo-500/10 rounded-2xl items-center justify-center border border-indigo-500/20">
            <Ionicons name="paper-plane-outline" size={20} color="#6366f1" />
          </View>
          <View>
            <Text className="text-white text-lg font-black tracking-tight">Central Kitchen Dispatch</Text>
            <Text className="text-slate-400 text-xs font-semibold">Select and dispatch inventory to stores</Text>
          </View>
        </View>
        <TouchableOpacity 
          className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700"
          onPress={fetchPendingTransfers}
        >
          <Ionicons name="refresh" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-6 h-[420px]">
        {/* Left Column: Pending List */}
        <View className="flex-1 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-4">
          <Text className="text-indigo-400 text-xs font-extrabold uppercase tracking-wider mb-3">
            Pending Shipments ({pendingTransfers.length})
          </Text>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#6366f1" size="small" />
            </View>
          ) : pendingTransfers.length === 0 ? (
            <View className="flex-1 items-center justify-center p-4">
              <Ionicons name="file-tray-outline" size={32} color="#475569" />
              <Text className="text-slate-500 text-xs text-center font-bold mt-2">
                No shipments currently pending dispatch
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {pendingTransfers.map((item) => {
                const isSelected = selectedTransfer?.id === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedTransfer(item)}
                    activeOpacity={0.8}
                    className={`p-4 rounded-xl mb-2 flex-row justify-between items-center border transition-all ${
                      isSelected 
                        ? 'bg-indigo-600/10 border-indigo-500/80 shadow-md' 
                        : 'bg-slate-900/40 border-slate-800/40 hover:bg-slate-800/20'
                    }`}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-white text-sm font-bold truncate">{item.item_name}</Text>
                      <Text className="text-slate-500 text-xs font-semibold mt-1">
                        To: {item.to_location}
                      </Text>
                    </View>
                    <View className="bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/30">
                      <Text className="text-indigo-300 text-xs font-extrabold">Qty: {item.quantity}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Right Column: Dispatch Control Panel */}
        <View className="w-[300px] bg-slate-950/40 rounded-2xl border border-slate-800/60 p-5 justify-between">
          {selectedTransfer ? (
            <View className="flex-1 justify-between">
              {/* Transfer Details Panel */}
              <View>
                <Text className="text-slate-400 text-xs font-extrabold uppercase tracking-wider mb-4">
                  Shipment Details
                </Text>
                
                <View className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mb-4">
                  <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1">Item Name</Text>
                  <Text className="text-white text-base font-extrabold mb-3">{selectedTransfer.item_name}</Text>
                  
                  <View className="flex-row gap-4 mb-3">
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[10px] font-bold uppercase mb-0.5">Quantity</Text>
                      <Text className="text-indigo-400 text-sm font-black">{selectedTransfer.quantity} units</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[10px] font-bold uppercase mb-0.5">Origin</Text>
                      <Text className="text-white text-xs font-bold">{selectedTransfer.from_location}</Text>
                    </View>
                  </View>
                  
                  <View>
                    <Text className="text-slate-500 text-[10px] font-bold uppercase mb-0.5">Destination</Text>
                    <Text className="text-emerald-400 text-xs font-extrabold">{selectedTransfer.to_location}</Text>
                  </View>
                </View>

                {/* Dispatch Trigger Panel */}
                <Text className="text-slate-400 text-xs font-extrabold uppercase tracking-wider mb-2">
                  Select transit duration (ETA)
                </Text>
                <Text className="text-slate-500 text-[10px] font-medium mb-3">
                  This sets the delivery deadline radar for the store
                </Text>

                {submitting ? (
                  <View className="py-6 items-center justify-center">
                    <ActivityIndicator color="#6366f1" size="small" />
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2.5">
                    {[15, 30, 45, 60].map((mins) => (
                      <TouchableOpacity
                        key={mins}
                        onPress={() => handleDispatch(mins)}
                        activeOpacity={0.8}
                        className="w-[47%] bg-indigo-600 py-3 rounded-xl items-center justify-center border border-indigo-400/20 active:bg-indigo-700"
                        style={{ shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }}
                      >
                        <Text className="text-white text-xs font-black">{mins} mins</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View className="flex-row items-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/40 mt-4">
                <Ionicons name="information-circle-outline" size={14} color="#64748b" />
                <Text className="text-slate-500 text-[10px] font-semibold leading-3 ml-2 flex-1">
                  Upon dispatch, this item's status updates to "in_transit".
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center p-6">
              <View className="w-14 h-14 bg-slate-900/60 rounded-full border border-slate-800 items-center justify-center mb-3">
                <Ionicons name="chevron-back" size={24} color="#475569" />
              </View>
              <Text className="text-slate-400 text-sm font-bold text-center">Select Shipment</Text>
              <Text className="text-slate-600 text-xs text-center font-medium mt-1 leading-4">
                Choose a pending shipment from the list to set ETA and dispatch
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
