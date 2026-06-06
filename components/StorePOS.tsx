import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface InventoryItem {
  product_id: string;
  stock_quantity: number;
  products: {
    name: string;
    price_cents: number;
    category: string;
    product_type: string;
  };
}

interface StorePOSProps {
  storeName: string;
}

export default function StorePOS({ storeName }: StorePOSProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selling, setSelling] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreInventory();
  }, [storeName]);

  const fetchStoreInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_levels')
        .select(`
          product_id,
          stock_quantity,
          products (name, price_cents, category, product_type)
        `)
        .eq('location_name', storeName)
        .order('last_updated_at', { ascending: false });

      if (error) throw error;
      
      // Filter out products that don't exist anymore or are purely raw materials we don't 'sell' directly.
      // But for POS, usually we sell "Finished Goods".
      const sellable = (data as any[] || []).filter(item => item.products?.category === 'Finished Goods' || item.products?.product_type === 'combo');
      
      setInventory(sellable);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async (item: InventoryItem, qty: number) => {
    setSelling(item.product_id);
    try {
      // We use process_pos_sale which deducts inventory and logs the sale for financial analytics
      const { error } = await supabase.rpc('process_pos_sale', {
        p_product_id: item.product_id,
        p_location_name: storeName,
        p_quantity: qty
      });

      if (error) {
        if (error.message.includes('Insufficient stock')) {
           Alert.alert("Out of Stock", `Not enough stock to sell ${qty} units of ${item.products.name}.`);
        } else {
           throw error;
        }
      } else {
        // Optimistic UI update or refresh
        await fetchStoreInventory();
        Alert.alert("Sale Successful", `Sold ${qty}x ${item.products.name}`);
      }
    } catch (err: any) {
      Alert.alert("Sale Error", err.message);
    } finally {
      setSelling(null);
    }
  };

  return (
    <View className="flex-1 bg-slate-900/60 p-6 rounded-[32px] border border-slate-800 backdrop-blur-md">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-indigo-500/10 rounded-2xl items-center justify-center border border-indigo-500/20">
            <Ionicons name="cart-outline" size={20} color="#6366f1" />
          </View>
          <View>
            <Text className="text-white text-lg font-black tracking-tight">{storeName} POS Terminal</Text>
            <Text className="text-slate-400 text-xs font-semibold">Simulate sales and instant inventory deduction</Text>
          </View>
        </View>
        <TouchableOpacity onPress={fetchStoreInventory} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700">
          <Ionicons name="refresh" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Main Container */}
      <View className="flex-1 min-h-[400px]">
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator color="#6366f1" size="small" />
          </View>
        ) : inventory.length === 0 ? (
          <View className="py-20 items-center justify-center">
            <Ionicons name="basket-outline" size={48} color="#334155" />
            <Text className="text-slate-400 text-sm font-bold mt-3">No Finished Goods in Stock</Text>
            <Text className="text-slate-600 text-xs text-center font-medium mt-1 leading-4 max-w-[280px]">
              Receive shipments via the Radar first to populate your sellable inventory.
            </Text>
          </View>
        ) : (
          <FlatList 
            data={inventory}
            keyExtractor={item => item.product_id}
            showsVerticalScrollIndicator={false}
            numColumns={2}
            columnWrapperStyle={{ gap: 16, marginBottom: 16 }}
            renderItem={({ item }) => (
              <View className="flex-1 bg-slate-950/50 border border-slate-800/80 rounded-2xl p-5" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 }}>
                
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 pr-3">
                    <Text className="text-white text-base font-extrabold mb-1">{item.products.name}</Text>
                    <Text className="text-emerald-400 text-xs font-black">
                      RM {((item.products.price_cents || 0) / 100).toFixed(2)}
                    </Text>
                  </View>
                  <View className="items-end bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Text className="text-slate-500 text-[10px] font-bold uppercase mb-0.5">In Stock</Text>
                    <Text className={`text-sm font-black ${item.stock_quantity < 10 ? 'text-rose-400' : 'text-indigo-400'}`}>
                      {item.stock_quantity}
                    </Text>
                  </View>
                </View>

                {/* Quick Sell Buttons */}
                <View className="flex-row gap-2 mt-auto">
                  <TouchableOpacity 
                    onPress={() => handleSell(item, 1)}
                    disabled={selling !== null}
                    className="flex-1 bg-indigo-600/20 py-2.5 rounded-xl border border-indigo-500/30 items-center justify-center active:bg-indigo-600/40"
                  >
                    {selling === item.product_id ? (
                      <ActivityIndicator size="small" color="#818cf8" />
                    ) : (
                      <Text className="text-indigo-400 text-xs font-black">Sell 1x</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => handleSell(item, 5)}
                    disabled={selling !== null}
                    className="flex-1 bg-indigo-600/20 py-2.5 rounded-xl border border-indigo-500/30 items-center justify-center active:bg-indigo-600/40"
                  >
                    <Text className="text-indigo-400 text-xs font-black">Sell 5x</Text>
                  </TouchableOpacity>
                </View>

              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
