import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface InventoryItem {
  product_id: string;
  stock_quantity: number;
  products: {
    name: string;
    category: string;
  };
}

interface StoreWastageProps {
  storeName: string;
}

export default function StoreWastage({ storeName }: StoreWastageProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  
  // Form state
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<'EXPIRED' | 'DAMAGED' | 'QUALITY_CHECK' | 'STAFF_MEAL' | 'OTHER'>('DAMAGED');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, [storeName]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_levels')
        .select(`
          product_id,
          stock_quantity,
          products (name, category)
        `)
        .eq('location_name', storeName)
        .gt('stock_quantity', 0)
        .order('last_updated_at', { ascending: false });

      if (error) throw error;
      setInventory(data as any[]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWriteoff = async () => {
    if (!selectedProduct) return Alert.alert("Error", "Select a product first.");
    const q = parseInt(qty, 10);
    if (isNaN(q) || q <= 0) return Alert.alert("Error", "Enter a valid quantity.");
    if (q > selectedProduct.stock_quantity) {
      return Alert.alert("Error", `You only have ${selectedProduct.stock_quantity} in stock.`);
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_writeoff', {
        p_product_id: selectedProduct.product_id,
        p_location_name: storeName,
        p_quantity: q,
        p_reason: reason,
        p_notes: notes || null
      });

      if (error) throw error;
      
      Alert.alert("Success", "Wastage recorded successfully.");
      setQty('');
      setNotes('');
      setSelectedProduct(null);
      fetchInventory();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 flex-row bg-slate-900/60 rounded-[32px] border border-slate-800 overflow-hidden min-h-[600px]">
       
       {/* Left Column: Select Product */}
       <View className="flex-1 p-6 border-r border-slate-800">
          <View className="flex-row items-center justify-between mb-6">
             <View>
               <Text className="text-white text-2xl font-black mb-1">Wastage & Write-offs</Text>
               <Text className="text-slate-400 font-bold">Log damaged or expired stock for {storeName}</Text>
             </View>
             <TouchableOpacity onPress={fetchInventory} className="p-2.5 bg-slate-800 rounded-xl">
               <Ionicons name="refresh" size={16} color="#94a3b8" />
             </TouchableOpacity>
          </View>
          
          {loading ? (
             <ActivityIndicator color="#6366f1" size="small" className="mt-10" />
          ) : inventory.length === 0 ? (
             <Text className="text-slate-500 italic text-center mt-10">No items with stock available.</Text>
          ) : (
             <FlatList 
               data={inventory}
               keyExtractor={item => item.product_id}
               showsVerticalScrollIndicator={false}
               renderItem={({ item }) => (
                 <TouchableOpacity 
                   onPress={() => setSelectedProduct(item)}
                   className={`flex-row justify-between items-center p-4 rounded-xl border mb-2 ${
                     selectedProduct?.product_id === item.product_id 
                       ? 'bg-rose-500/20 border-rose-500/50' 
                       : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/80'
                   }`}
                 >
                   <View>
                     <Text className="text-white font-bold">{item.products.name}</Text>
                     <Text className="text-slate-500 text-[10px] uppercase mt-1">{item.products.category}</Text>
                   </View>
                   <View className="items-end">
                     <Text className="text-slate-400 text-[10px] uppercase mb-0.5">In Stock</Text>
                     <Text className={`font-black ${item.stock_quantity < 5 ? 'text-amber-400' : 'text-indigo-400'}`}>
                       {item.stock_quantity}
                     </Text>
                   </View>
                 </TouchableOpacity>
               )}
             />
          )}
       </View>

       {/* Right Column: Write-off Form */}
       <View className="w-96 bg-slate-950 p-6 flex-col">
          {selectedProduct ? (
            <>
              <Text className="text-white text-xl font-black mb-6">Report Wastage</Text>
              
              <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
                <Text className="text-slate-400 text-xs font-bold mb-1">Selected Item</Text>
                <Text className="text-white font-black text-lg">{selectedProduct.products.name}</Text>
                <Text className="text-indigo-400 font-bold text-sm mt-1">Available: {selectedProduct.stock_quantity}</Text>
              </View>

              <Text className="text-slate-400 text-xs font-bold mb-2 uppercase">Quantity to Write-off</Text>
              <TextInput 
                value={qty}
                onChangeText={setQty}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#64748b"
                className="bg-slate-900 border border-slate-700 text-white font-bold p-4 rounded-xl mb-6 text-lg"
              />

              <Text className="text-slate-400 text-xs font-bold mb-2 uppercase">Reason</Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {(['DAMAGED', 'EXPIRED', 'QUALITY_CHECK', 'STAFF_MEAL', 'OTHER'] as const).map(r => (
                  <TouchableOpacity 
                    key={r}
                    onPress={() => setReason(r)}
                    className={`px-3 py-2 border rounded-lg ${reason === r ? 'bg-rose-500 border-rose-400' : 'bg-slate-900 border-slate-700'}`}
                  >
                    <Text className={`text-xs font-black ${reason === r ? 'text-white' : 'text-slate-400'}`}>
                      {r.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-slate-400 text-xs font-bold mb-2 uppercase">Additional Notes (Optional)</Text>
              <TextInput 
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g., Dropped on floor"
                placeholderTextColor="#64748b"
                multiline
                className="bg-slate-900 border border-slate-700 text-white font-bold p-4 rounded-xl mb-8 min-h-[80px]"
              />

              <TouchableOpacity 
                onPress={handleSubmitWriteoff}
                disabled={submitting || !qty}
                className={`py-4 rounded-xl items-center justify-center flex-row gap-2 mt-auto ${
                  submitting || !qty ? 'bg-slate-800' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-bin-outline" size={18} color="white" />
                    <Text className="text-white font-black text-base">Confirm Write-off</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View className="flex-1 items-center justify-center">
               <Ionicons name="alert-circle-outline" size={48} color="#334155" />
               <Text className="text-slate-500 font-bold mt-4">Select an item from the left</Text>
            </View>
          )}
       </View>
    </View>
  );
}
