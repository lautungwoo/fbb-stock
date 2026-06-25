import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface TransitTransfer {
  id: string;
  product_id?: string;
  item_name: string;
  quantity: number;
  from_location: string;
  to_location: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  dispatched_at: string;
  estimated_arrival_at: string;
  notes?: string;
}

interface ReceivingRadarProps {
  storeName?: string; // Optional: filter by receiving store name, e.g. 'Store A'
  onReceiveSuccess?: () => void;
}

const ReceivingRow = React.memo(({
  item,
  viewMode,
  now,
  storeName,
  handleDeleteTransfer,
  handleOpenConfirm,
  formatTimeDiff
}: {
  item: TransitTransfer;
  viewMode: 'in_transit' | 'completed';
  now: Date;
  storeName?: string;
  handleDeleteTransfer: (id: string) => void;
  handleOpenConfirm: (item: TransitTransfer) => void;
  formatTimeDiff: (ms: number) => string;
}) => {
  const estTime = new Date(item.estimated_arrival_at).getTime();
  const diffMs = estTime - now.getTime();
  const isDelayed = diffMs < 0;

  return (
    <View
      className={`w-[48%] rounded-2xl border p-5 flex flex-col justify-between ${
        viewMode === 'completed' ? 'bg-slate-900/50 border-slate-800' :
        isDelayed 
          ? 'bg-rose-500/10 border-rose-500/30' 
          : 'bg-emerald-500/5 border-emerald-500/20'
      }`}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 }}
    >
      <View>
        {/* Status Pill & Location Header */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-row items-center gap-1.5 mt-1">
            <View className={`w-2.5 h-2.5 rounded-full ${viewMode === 'completed' ? 'bg-slate-500' : isDelayed ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            <Text className={`text-[10px] font-black uppercase ${viewMode === 'completed' ? 'text-slate-400' : isDelayed ? 'text-rose-400' : 'text-emerald-400'}`}>
              {viewMode === 'completed' ? 'DELIVERED' : isDelayed ? 'DELAYED' : 'IN TRANSIT'}
            </Text>
          </View>
          <View className="flex-row items-start gap-3">
            <View className="items-end">
              <Text className="text-slate-500 text-[10px] font-bold">From: {item.from_location}</Text>
              {!storeName && <Text className="text-indigo-400 text-[11px] font-black">To: {item.to_location}</Text>}
            </View>
            {/* HQ Delete Button */}
            {!storeName && (
              <TouchableOpacity 
                onPress={() => handleDeleteTransfer(item.id)}
                className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20"
              >
                <Ionicons name="trash-outline" size={14} color="#f43f5e" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Cargo Info */}
        <Text className="text-white text-base font-extrabold mb-1">{item.item_name}</Text>
        <Text className="text-slate-400 text-xs font-semibold mb-3">
          Quantity: <Text className="text-indigo-400 font-bold">{item.quantity} units</Text>
        </Text>
      </View>

      <View className="mt-2">
        {/* Time Display */}
        {viewMode === 'completed' ? (
          <View className="p-3 rounded-xl border bg-slate-950/40 border-slate-800/80 mb-2">
            <Text className="text-slate-500 text-[10px] font-bold mb-1">Receipt Notes:</Text>
            <Text className="text-slate-300 text-xs italic">
              {item.notes || 'No notes provided during receipt.'}
            </Text>
          </View>
        ) : (
          <>
            {/* Countdown Timer Display */}
            <View className={`p-3 rounded-xl border mb-4 flex-row items-center justify-between ${
              isDelayed 
                ? 'bg-rose-950/20 border-rose-500/20' 
                : 'bg-emerald-950/20 border-emerald-500/20'
            }`}>
              <View className="flex-row items-center gap-2">
                <Ionicons 
                  name={isDelayed ? "alert-circle" : "time"} 
                  size={16} 
                  color={isDelayed ? "#ef4444" : "#10b981"} 
                />
                <Text className={`text-xs font-bold ${isDelayed ? 'text-rose-500 font-black' : 'text-slate-400'}`}>
                  {isDelayed ? 'Delayed by:' : 'Remaining:'}
                </Text>
              </View>
              <Text className={`text-sm font-extrabold tracking-wider ${isDelayed ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {formatTimeDiff(diffMs)}
              </Text>
            </View>

            {/* Action Button (Only for Store Manager, HQ views it read-only) */}
            {storeName && (
              <TouchableOpacity
                onPress={() => handleOpenConfirm(item)}
                activeOpacity={0.8}
                className={`w-full py-3.5 rounded-xl items-center justify-center flex-row gap-2 border ${
                  isDelayed
                    ? 'bg-rose-600 border-rose-500/30 active:bg-rose-700'
                    : 'bg-emerald-600 border-emerald-500/30 active:bg-emerald-700'
                }`}
              >
                <Ionicons name="checkbox-outline" size={16} color="white" />
                <Text className="text-white text-xs font-black">Confirm Receive</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
});

export default function ReceivingRadar({ storeName, onReceiveSuccess }: ReceivingRadarProps) {
  const [transfers, setTransfers] = useState<TransitTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'in_transit' | 'completed'>('in_transit');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('today');
  
  // Modal states for [Receive] confirmation
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<TransitTransfer | null>(null);
  const [actualReceived, setActualReceived] = useState('');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Poll database for updates every 10 seconds
  const fetchTransitTransfers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_transfers')
        .select('*')
        .eq('status', viewMode)
        .is('cancelled_at', null);

      if (storeName) {
        query = query.eq('to_location', storeName);
      }

      // Apply time filter for completed records
      if (viewMode === 'completed' && timeFilter !== 'all') {
        const date = new Date();
        if (timeFilter === 'today') {
          date.setHours(0, 0, 0, 0);
        } else if (timeFilter === 'week') {
          date.setDate(date.getDate() - 7);
        } else if (timeFilter === 'month') {
          date.setMonth(date.getMonth() - 1);
        }
        query = query.gte('updated_at', date.toISOString());
      }

      // If viewing completed, sort by updated_at descending
      const { data, error } = await query.order(viewMode === 'in_transit' ? 'estimated_arrival_at' : 'updated_at', { ascending: viewMode === 'in_transit' });

      if (error) throw error;
      setTransfers(data || []);
    } catch (err: any) {
      console.error("Error fetching transit transfers:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Keep a second-by-second countdown clock running
  useEffect(() => {
    fetchTransitTransfers();

    const clockTimer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    // Refresh data in background every 10 seconds
    const dataTimer = setInterval(() => {
      fetchTransitTransfers();
    }, 10000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(dataTimer);
    };
  }, [storeName, viewMode]);

  const handleOpenConfirm = (transfer: TransitTransfer) => {
    setActiveTransfer(transfer);
    setActualReceived(transfer.quantity.toString());
    setDiscrepancyNotes('');
    setConfirmModalVisible(true);
  };

  const handleConfirmReceive = async () => {
    if (!activeTransfer) return;

    const actualQty = parseInt(actualReceived, 10);
    if (isNaN(actualQty) || actualQty < 0) {
      Alert.alert("Invalid Input", "Actual received quantity must be a valid number.");
      return;
    }

    setSubmitting(true);

    try {
      // Call our robust PL/pgSQL RPC
      const { error } = await supabase.rpc('receive_inventory_transfer', {
        p_transfer_id: activeTransfer.id,
        p_actual_received_qty: actualQty,
        p_discrepancy_notes: discrepancyNotes.trim() || null
      });

      if (error) throw error;

      Alert.alert(
        "Inventory Received",
        `Receipt confirmed for ${actualQty} units of [${activeTransfer.item_name}]. Stock updated!`
      );

      setConfirmModalVisible(false);
      setActiveTransfer(null);
      setActualReceived('');
      setDiscrepancyNotes('');
      await fetchTransitTransfers();
      if (onReceiveSuccess) onReceiveSuccess();
    } catch (err: any) {
      Alert.alert("Receipt Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveAll = () => {
    if (transfers.length === 0) return;

    Alert.alert(
      "Quick Receive All?",
      "This will instantly receive ALL currently displayed in-transit items at their FULL expected quantities.\n\n⚠️ If any items have discrepancies (missing/damaged), please receive them individually first before clicking this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Receive All",
          style: "default",
          onPress: async () => {
            setLoading(true);
            try {
              // Execute all receipts concurrently
              const promises = transfers.map(t => 
                supabase.rpc('receive_inventory_transfer', {
                  p_transfer_id: t.id,
                  p_actual_received_qty: t.quantity,
                  p_discrepancy_notes: null
                })
              );
              
              const results = await Promise.all(promises);
              
              // Check if any failed
              const errors = results.filter(r => r.error);
              if (errors.length > 0) {
                throw errors[0].error;
              }

              Alert.alert("Success", "All shipments received perfectly and added to inventory!");
              await fetchTransitTransfers();
              if (onReceiveSuccess) onReceiveSuccess();
            } catch (err: any) {
              Alert.alert("Batch Receipt Error", err.message);
              // Still refresh to see what went through
              fetchTransitTransfers();
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteTransfer = (id: string) => {
    Alert.alert(
      "Delete Transfer",
      "Are you sure you want to delete this record? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.from('inventory_transfers').update({ cancelled_at: new Date().toISOString() }).eq('id', id);
              if (error) throw error;
              fetchTransitTransfers();
            } catch (err: any) {
              Alert.alert("Delete Error", err.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Format millisecond duration into "12m 30s" style string
  const formatTimeDiff = (ms: number) => {
    const absMs = Math.abs(ms);
    const totalSecs = Math.floor(absMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    let timeString = '';
    if (hours > 0) timeString += `${hours}h `;
    timeString += `${mins}m ${secs}s`;
    return timeString;
  };

  return (
    <View className="flex-1 bg-slate-900/60 p-6 rounded-[32px] border border-slate-800 backdrop-blur-md">
      {/* Main Container */}
      <FlatList
        data={transfers}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', gap: 16, marginBottom: 16 }}
        showsVerticalScrollIndicator={false}
        className="flex-1 min-h-[350px]"
        ListHeaderComponent={
          <View className="flex-row flex-wrap items-center justify-between mb-6 gap-y-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-emerald-500/10 rounded-2xl items-center justify-center border border-emerald-500/20">
                <Ionicons name="radar-outline" size={20} color="#10b981" />
              </View>
              <View>
                <Text className="text-white text-lg font-black tracking-tight">
                  {storeName ? 'Receiving Store Countdown Radar' : 'HQ Global Fleet Radar'}
                </Text>
                <Text className="text-slate-400 text-xs font-semibold">
                  Live monitoring of shipments {storeName ? `for ${storeName}` : 'across all stores'}
                </Text>
              </View>
            </View>
            
            <View className="flex-row items-center gap-3">
              {/* Time Filter for Completed Mode */}
              {viewMode === 'completed' && (
                <View className="flex-row bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mr-2">
                  {(['today', 'week', 'month', 'all'] as const).map(f => (
                    <TouchableOpacity 
                      key={f}
                      onPress={() => setTimeFilter(f)}
                      className={`px-3 py-2 border-r border-slate-800 ${timeFilter === f ? 'bg-slate-700' : 'bg-transparent'}`}
                    >
                      <Text className={`text-[10px] font-bold uppercase ${timeFilter === f ? 'text-white' : 'text-slate-500'}`}>
                        {f}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View className="flex-row bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <TouchableOpacity 
                  onPress={() => setViewMode('in_transit')}
                  className={`px-4 py-2 rounded-lg ${viewMode === 'in_transit' ? 'bg-indigo-600' : 'bg-transparent'}`}
                >
                  <Text className={`text-xs font-bold ${viewMode === 'in_transit' ? 'text-white' : 'text-slate-400'}`}>In Transit</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setViewMode('completed')}
                  className={`px-4 py-2 rounded-lg ${viewMode === 'completed' ? 'bg-indigo-600' : 'bg-transparent'}`}
                >
                  <Text className={`text-xs font-bold ${viewMode === 'completed' ? 'text-white' : 'text-slate-400'}`}>Completed</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Receive All (Only for Store Manager and In Transit view) */}
              {storeName && viewMode === 'in_transit' && transfers.length > 0 && (
                <TouchableOpacity 
                  className="px-4 py-2.5 bg-emerald-600 rounded-xl hover:bg-emerald-500 border border-emerald-500/50 flex-row items-center gap-1.5"
                  onPress={handleReceiveAll}
                >
                  <Ionicons name="flash" size={14} color="white" />
                  <Text className="text-white text-xs font-black">Receive All</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 border border-slate-700/50"
                onPress={fetchTransitTransfers}
              >
                <Ionicons name="refresh" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator color="#10b981" size="small" />
            </View>
          ) : (
            <View className="py-20 items-center justify-center">
              <Ionicons name="shield-outline" size={48} color="#334155" />
              <Text className="text-slate-400 text-sm font-bold mt-3">All clear! No shipments in transit</Text>
              <Text className="text-slate-600 text-xs text-center font-medium mt-1 leading-4 max-w-[280px]">
                New shipments dispatched from the Central Kitchen will broadcast and pop up here in real-time.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ReceivingRow
            item={item}
            viewMode={viewMode}
            now={now}
            storeName={storeName}
            handleDeleteTransfer={handleDeleteTransfer}
            handleOpenConfirm={handleOpenConfirm}
            formatTimeDiff={formatTimeDiff}
          />
        )}
      />

      {/* Custom Secondary Confirmation Modal */}
      {activeTransfer && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={confirmModalVisible}
          onRequestClose={() => setConfirmModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/75 px-4 backdrop-blur-sm">
            <View className="w-full max-w-[480px] bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-2xl">
              {/* Modal Header */}
              <View className="flex-row justify-between items-center mb-5 pb-4 border-b border-slate-800">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-9 h-9 bg-emerald-500/10 rounded-xl items-center justify-center">
                    <Ionicons name="shield-checkmark" size={18} color="#10b981" />
                  </View>
                  <Text className="text-white text-base font-extrabold">Confirming Receipt</Text>
                </View>
                <TouchableOpacity 
                  className="p-1 bg-slate-800 rounded-full" 
                  onPress={() => setConfirmModalVisible(false)}
                >
                  <Ionicons name="close" size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Delivery Details Details */}
              <View className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 mb-5">
                <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1">Expected Delivery</Text>
                <Text className="text-white text-lg font-black leading-6 mb-3">
                  {activeTransfer.quantity} units of {activeTransfer.item_name}
                </Text>
                
                <Text className="text-slate-400 text-xs font-bold mb-2">Actual Quantity Received:</Text>
                <TextInput
                  keyboardType="numeric"
                  value={actualReceived}
                  onChangeText={setActualReceived}
                  className="w-full bg-slate-900 text-white text-base font-bold p-3 rounded-xl border border-slate-700 focus:border-emerald-500 mb-3"
                />

                <Text className="text-slate-500 text-[10px] font-semibold mt-1">
                  Dispatched from: {activeTransfer.from_location} → {activeTransfer.to_location}
                </Text>
              </View>

              {/* Text Area for Discrepancy Recording */}
              <Text className="text-slate-400 text-xs font-bold mb-2">Any discrepancies / damage logs?</Text>
              <TextInput
                multiline
                numberOfLines={3}
                placeholder="e.g. 2 boxes damaged during delivery, or shorthand note..."
                placeholderTextColor="#475569"
                value={discrepancyNotes}
                onChangeText={setDiscrepancyNotes}
                className="w-full bg-slate-950 text-white text-xs font-semibold p-4 rounded-xl border border-slate-800 focus:border-emerald-500 mb-6"
                style={{ height: 75, textAlignVertical: 'top' }}
              />

              {/* Bottom Buttons Panel */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setConfirmModalVisible(false)}
                  disabled={submitting}
                  className="flex-1 bg-slate-800 py-3.5 rounded-xl items-center justify-center border border-slate-700/20 active:bg-slate-700"
                >
                  <Text className="text-slate-400 text-xs font-extrabold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmReceive}
                  disabled={submitting}
                  className="flex-2 flex-row gap-1.5 items-center justify-center bg-emerald-600 py-3.5 rounded-xl border border-emerald-500/20 active:bg-emerald-700"
                  style={{ flex: 2 }}
                >
                  {submitting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                      <Text className="text-white text-xs font-black">Confirm Receive</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
