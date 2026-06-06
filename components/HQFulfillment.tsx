import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

export default function HQFulfillment({ onFulfillSuccess }: { onFulfillSuccess?: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [hqStock, setHqStock] = useState<Record<string, number>>({});
  const [fulfilledQuantities, setFulfilledQuantities] = useState<Record<string, string>>({});
  const [showEta, setShowEta] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('store_orders')
        .select(`
          *,
          stores ( name ),
          store_order_items (
            id, product_id, quantity_requested, unit_price_cents,
            products ( name, base_unit )
          )
        `)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch HQ stock for all products
      const { data: stockData, error: stockError } = await supabase
        .from('inventory_levels')
        .select('product_id, stock_quantity')
        .eq('location_name', 'Central Kitchen');
      
      if (stockError) throw stockError;
      
      const stockMap: Record<string, number> = {};
      stockData?.forEach(row => {
        stockMap[row.product_id] = row.stock_quantity;
      });
      setHqStock(stockMap);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error fetching orders", e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectOrder = (order: any) => {
    setSelectedOrder(order);
    setShowEta(false);
    // Initialize partial fulfillment quantities
    const initQts: Record<string, string> = {};
    order.store_order_items.forEach((item: any) => {
      initQts[item.id] = item.quantity_requested.toString();
    });
    setFulfilledQuantities(initQts);
  };

  const handleApproveAndDispatch = async (etaMinutes: number) => {
    if (!selectedOrder) return;
    setSubmitting(true);

    try {
      // 1. Validate all stock again to be absolutely sure
      const itemsToFulfill = selectedOrder.store_order_items.map((item: any) => ({
        ...item,
        finalQty: parseInt(fulfilledQuantities[item.id] || '0', 10)
      })).filter((item: any) => item.finalQty > 0);

      for (const item of itemsToFulfill) {
        const available = hqStock[item.product_id] || 0;
        if (item.finalQty > available) {
          throw new Error(`Insufficient stock for ${item.products?.name}. Available: ${available}, Required: ${item.finalQty}`);
        }
      }

      const now = new Date();
      const dispatchedAt = now.toISOString();
      const estimatedArrivalAt = new Date(now.getTime() + etaMinutes * 60 * 1000).toISOString();

      // 2. Process each item (Update fulfillment, Deduct Stock, Create Transfer)
      for (const item of itemsToFulfill) {
        // Create transfer record (Phase 1)
        await supabase.from('inventory_transfers').insert([{
          product_id: item.product_id,
          item_name: item.products?.name,
          quantity: item.finalQty,
          from_location: 'Central Kitchen',
          to_location: selectedOrder.stores?.name,
          status: 'in_transit',
          dispatched_at: dispatchedAt,
          estimated_arrival_at: estimatedArrivalAt
        }]);

        // Deduct HQ Stock
        const currentStock = hqStock[item.product_id] || 0;
        await supabase.from('inventory_levels').update({
          stock_quantity: currentStock - item.finalQty,
          last_updated_at: new Date().toISOString()
        }).eq('product_id', item.product_id).eq('location_name', 'Central Kitchen');

        // Update item fulfilled amount
        await supabase.from('store_order_items').update({
          quantity_fulfilled: item.finalQty
        }).eq('id', item.id);
      }

      // 3. Mark Order as Dispatched
      await supabase.from('store_orders').update({
        status: 'DISPATCHED',
        fulfilled_at: new Date().toISOString()
      }).eq('id', selectedOrder.id);

      Alert.alert("Success", `Order dispatched! ETA: +${etaMinutes} mins.`);
      setSelectedOrder(null);
      setShowEta(false);
      await fetchOrders();
      if (onFulfillSuccess) onFulfillSuccess();

    } catch (e: any) {
      console.error(e);
      Alert.alert("Dispatch Failed", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectOrder = (orderId: string) => {
    Alert.alert(
      "Reject Order",
      "Are you sure you want to reject this order? The store will see it as rejected.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reject", 
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.from('store_orders').update({ status: 'REJECTED' }).eq('id', orderId);
              if (error) throw error;
              await fetchOrders();
              if (onFulfillSuccess) onFulfillSuccess();
            } catch (err: any) {
              Alert.alert("Reject Error", err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 flex-row bg-slate-900/60 rounded-[32px] border border-slate-800 overflow-hidden min-h-[600px]">
       
       {/* Left Column: Pending Orders List */}
       <View className="w-1/3 p-6 border-r border-slate-800 flex-col">
          <Text className="text-white text-2xl font-black mb-1">HQ Fulfillment</Text>
          <Text className="text-slate-400 font-bold mb-6">Review & Dispatch Store Orders</Text>
          
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
             {loading ? (
               <ActivityIndicator color="#6366f1" size="small" />
             ) : orders.length === 0 ? (
               <Text className="text-slate-500 italic text-sm">No pending orders.</Text>
             ) : (
               orders.map(order => (
                 <TouchableOpacity 
                   key={order.id}
                   onPress={() => selectOrder(order)}
                   className={`p-4 rounded-xl border mb-3 transition-all ${
                     selectedOrder?.id === order.id ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                   }`}
                 >
                    <View className="flex-row justify-between mb-2">
                       <Text className="text-white font-bold">{order.stores?.name}</Text>
                       <Text className="text-indigo-400 font-black">{order.status}</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-500 text-xs">Total Items: {order.store_order_items?.length || 0}</Text>
                      <TouchableOpacity 
                        onPress={() => handleRejectOrder(order.id)}
                        className="p-1.5 bg-rose-500/10 rounded border border-rose-500/20"
                      >
                        <Ionicons name="close-circle-outline" size={14} color="#f43f5e" />
                      </TouchableOpacity>
                    </View>
                 </TouchableOpacity>
               ))
             )}
          </ScrollView>
       </View>

       {/* Right Column: Order Details & Approval */}
       <View className="flex-1 p-6 bg-slate-950 flex-col">
          {selectedOrder ? (
            <>
               <View className="flex-row justify-between items-center mb-6">
                 <Text className="text-white text-xl font-black">Order Details</Text>
                 <Text className="text-slate-500 font-bold">{selectedOrder.stores?.name}</Text>
               </View>

               <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                 {selectedOrder.store_order_items.map((item: any) => {
                   const available = hqStock[item.product_id] || 0;
                   const reqQty = parseInt(fulfilledQuantities[item.id] || '0', 10);
                   const isInsufficient = reqQty > available;

                   return (
                     <View key={item.id} className="mb-4">
                       <View className="flex-row justify-between items-center p-4 bg-slate-900 rounded-xl border border-slate-800">
                          <Text className="text-white font-bold flex-1">{item.products?.name}</Text>
                          <View className="flex-row items-center gap-3">
                             <Text className="text-slate-500 text-xs uppercase">Req: {item.quantity_requested}</Text>
                             <TextInput 
                               value={fulfilledQuantities[item.id] || ''}
                               onChangeText={txt => setFulfilledQuantities(p => ({...p, [item.id]: txt}))}
                               keyboardType="numeric"
                               className={`bg-slate-950 text-white font-bold p-2 w-16 text-center rounded-lg border ${isInsufficient ? 'border-rose-500' : 'border-slate-700 focus:border-indigo-500'}`}
                             />
                          </View>
                       </View>
                       {isInsufficient && (
                         <Text className="text-rose-500 text-xs font-bold mt-2 text-right">
                           Insufficient HQ Stock! (Current: {available})
                         </Text>
                       )}
                     </View>
                   );
                 })}
               </ScrollView>

               {showEta ? (
                 <View className="bg-slate-900 border border-indigo-500/30 p-4 rounded-xl mt-6">
                    <Text className="text-white font-bold mb-3 text-center">Select Dispatch ETA</Text>
                    {submitting ? (
                      <ActivityIndicator color="#6366f1" size="small" />
                    ) : (
                      <View className="flex-row justify-between gap-2">
                        {[15, 30, 45, 60].map(mins => (
                          <TouchableOpacity 
                            key={mins}
                            onPress={() => handleApproveAndDispatch(mins)}
                            className="flex-1 bg-indigo-600 py-3 rounded-lg items-center"
                          >
                            <Text className="text-white font-bold text-xs">{mins}m</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                 </View>
               ) : (
                 <TouchableOpacity 
                   onPress={() => {
                     // Check if any item is still insufficient
                     const hasError = selectedOrder.store_order_items.some((item: any) => {
                       const req = parseInt(fulfilledQuantities[item.id] || '0', 10);
                       const av = hqStock[item.product_id] || 0;
                       return req > av;
                     });
                     if (hasError) {
                       Alert.alert("Insufficient Stock", "Please reduce quantities for highlighted items.");
                       return;
                     }
                     setShowEta(true);
                   }} 
                   className="bg-emerald-600 p-4 rounded-xl mt-6 hover:bg-emerald-700"
                 >
                   <Text className="text-white text-center font-bold text-base">Approve & Dispatch</Text>
                 </TouchableOpacity>
               )}
            </>
          ) : (
            <View className="flex-1 items-center justify-center">
               <Ionicons name="cube-outline" size={48} color="#334155" />
               <Text className="text-slate-500 font-bold mt-4">Select an order from the left to review</Text>
            </View>
          )}
       </View>
    </View>
  );
}
