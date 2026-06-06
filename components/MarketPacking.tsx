import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

export default function MarketPacking() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPacking, setIsPacking] = useState(false);
  const [packList, setPackList] = useState<{ product: any, qty: string }[]>([]);
  
  const [sourceLocation] = useState('Central Kitchen');
  const [destinationLocation] = useState('Pop-up Market');

  useEffect(() => {
    fetchHQInventory();
  }, []);

  const fetchHQInventory = async () => {
    setLoading(true);
    try {
      // Get all products and their stock in HQ
      const { data: invData, error: invError } = await supabase
        .from('inventory_levels')
        .select('stock_quantity, products(id, name, category, base_unit)')
        .eq('location_name', sourceLocation)
        .gt('stock_quantity', 0);
        
      if (invError) throw invError;
      
      const formatted = (invData || []).map(row => ({
        id: row.products?.id,
        name: row.products?.name,
        category: row.products?.category,
        base_unit: row.products?.base_unit,
        currentStock: row.stock_quantity
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      setProducts(formatted);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPack = (product: any, qty: string) => {
    const q = parseInt(qty, 10);
    if (isNaN(q) || q <= 0) return Alert.alert('Invalid', 'Enter a valid quantity');
    if (q > product.currentStock) return Alert.alert('Error', 'Cannot pack more than available stock at HQ');

    setPackList(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: (parseInt(item.qty, 10) + q).toString() } : item);
      }
      return [...prev, { product, qty: q.toString() }];
    });
  };

  const handleRemove = (id: string) => {
    setPackList(prev => prev.filter(item => item.product.id !== id));
  };

  const submitPackingList = async () => {
    if (packList.length === 0) return Alert.alert("Empty", "Add items to pack first.");
    setIsPacking(true);
    
    try {
      for (const item of packList) {
        const qty = parseInt(item.qty, 10);
        
        // 1. Deduct from HQ
        const { error: deductErr } = await supabase.rpc('deduct_inventory_v2', {
          p_product_id: item.product.id,
          p_location_name: sourceLocation,
          p_quantity: qty,
          p_is_strict_stock: true
        });
        if (deductErr) throw deductErr;

        // 2. Add to Pop-up Market (We check if row exists, if not insert, else update)
        // A safer way is to fetch existing first, or rely on an upsert. 
        // For simplicity using client-side check:
        const { data: existingDest } = await supabase
          .from('inventory_levels')
          .select('id, stock_quantity')
          .eq('product_id', item.product.id)
          .eq('location_name', destinationLocation)
          .single();

        if (existingDest) {
          const { error: updateErr } = await supabase
            .from('inventory_levels')
            .update({ stock_quantity: existingDest.stock_quantity + qty, last_updated_at: new Date().toISOString() })
            .eq('id', existingDest.id);
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from('inventory_levels')
            .insert([{
              product_id: item.product.id,
              location_name: destinationLocation,
              stock_quantity: qty
            }]);
          if (insertErr) throw insertErr;
        }
      }

      Alert.alert("Success", "Stock has been securely transferred to Pop-up Market.");
      setPackList([]);
      fetchHQInventory();
    } catch (e: any) {
      console.error(e);
      Alert.alert("Transfer Failed", e.message);
    } finally {
      setIsPacking(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-900/60 rounded-[32px] border border-slate-800 overflow-hidden flex-col min-h-[600px]">
      <View className="flex-row justify-between items-center p-6 border-b border-slate-800">
         <View className="flex-row items-center gap-4">
           <View className="w-12 h-12 bg-indigo-500/10 rounded-2xl items-center justify-center border border-indigo-500/20">
             <Ionicons name="cube" size={24} color="#6366f1" />
           </View>
           <View>
             <Text className="text-white text-2xl font-black mb-1">Pop-up Packing Station</Text>
             <Text className="text-slate-400 font-bold text-xs">Direct Transfer: <Text className="text-emerald-400">{sourceLocation}</Text> ➡️ <Text className="text-indigo-400">{destinationLocation}</Text></Text>
           </View>
         </View>
      </View>

      <View className="flex-1 flex-row">
        {/* Left: HQ Inventory List */}
        <View className="flex-1 p-6">
          <Text className="text-white font-black mb-4 text-lg">HQ Available Stock</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {loading ? (
               <ActivityIndicator color="#6366f1" />
            ) : products.length === 0 ? (
               <Text className="text-slate-500 italic">No stock available at HQ.</Text>
            ) : (
               <View className="flex-row flex-wrap gap-3">
                 {products.map(p => (
                   <View key={p.id} className="w-[31%] bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                     <Text className="text-white font-bold truncate mb-1">{p.name}</Text>
                     <View className="flex-row justify-between items-center mb-3">
                       <Text className="text-slate-400 text-[10px] uppercase font-bold">{p.category}</Text>
                       <Text className="text-indigo-400 font-black">{p.currentStock} {p.base_unit}</Text>
                     </View>
                     <PackInput product={p} onPack={handleAddToPack} />
                   </View>
                 ))}
               </View>
            )}
          </ScrollView>
        </View>

        {/* Right: Packing List */}
        <View className="w-80 bg-slate-950 p-6 border-l border-slate-800 flex-col">
          <Text className="text-white text-xl font-black mb-4">Pack List</Text>
          
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {packList.length === 0 ? (
              <Text className="text-slate-500 italic text-sm">No items added yet...</Text>
            ) : (
              packList.map((item, idx) => (
                <View key={idx} className="flex-row justify-between items-center bg-slate-900 p-3 rounded-xl mb-2 border border-slate-800">
                  <View className="flex-1 pr-2">
                    <Text className="text-white font-bold text-sm" numberOfLines={1}>{item.product.name}</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Text className="text-indigo-400 font-black">{item.qty} {item.product.base_unit}</Text>
                    <TouchableOpacity onPress={() => handleRemove(item.product.id)}>
                      <Ionicons name="trash-outline" size={14} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity 
             onPress={submitPackingList} 
             disabled={isPacking || packList.length === 0}
             className={`mt-4 p-4 rounded-xl items-center justify-center flex-row gap-2 ${isPacking || packList.length === 0 ? 'bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
             <Ionicons name="checkmark-circle" size={20} color={isPacking || packList.length === 0 ? '#475569' : 'white'} />
             <Text className="text-white font-bold text-base">{isPacking ? 'Transferring...' : 'Transfer to Pop-up'}</Text>
           </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function PackInput({ product, onPack }: { product: any, onPack: (p: any, q: string) => void }) {
  const [qty, setQty] = useState('');
  return (
    <View className="flex-row gap-2">
      <TextInput 
        placeholder="Qty"
        placeholderTextColor="#64748b"
        keyboardType="numeric"
        value={qty}
        onChangeText={setQty}
        className="flex-1 bg-slate-900 text-white p-2 rounded-lg border border-slate-700 text-xs text-center focus:border-indigo-500" 
      />
      <TouchableOpacity 
        onPress={() => { onPack(product, qty); setQty(''); }}
        disabled={!qty}
        className={`p-2 rounded-lg items-center justify-center px-3 ${!qty ? 'bg-slate-700' : 'bg-indigo-600'}`}
      >
        <Text className="text-white text-xs font-bold">Pack</Text>
      </TouchableOpacity>
    </View>
  );
}
