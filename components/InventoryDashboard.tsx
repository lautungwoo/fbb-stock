import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface InventoryLevel {
  id: string;
  product_id: string;
  location_name: string;
  stock_quantity: number;
  last_updated_at: string;
  products?: {
    name: string;
    category: string;
    product_type: string;
  };
}

export default function InventoryDashboard() {
  const [inventory, setInventory] = useState<InventoryLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<'All' | 'Central Kitchen' | 'Store A' | 'Store B'>('All');
  const [financials, setFinancials] = useState({ revenue: 0, margin: 0, writeoffs: 0 });

  const fetchFinancials = async () => {
    try {
      const { data: sales } = await supabase.from('sales_transactions').select('total_cents, cost_cents_at_sale');
      const { data: writeoffs } = await supabase.from('inventory_writeoffs').select('quantity, products(cost_cents)');
      
      let rev = 0;
      let cogs = 0;
      if (sales) {
        sales.forEach(s => {
          rev += s.total_cents || 0;
          cogs += s.cost_cents_at_sale || 0;
        });
      }
      
      let wCost = 0;
      if (writeoffs) {
        writeoffs.forEach((w: any) => {
           wCost += (w.quantity * (w.products?.cost_cents || 0));
        });
      }
      
      setFinancials({ revenue: rev, margin: rev - cogs, writeoffs: wCost });
    } catch (err: any) {
      console.error("Error fetching financials:", err.message);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventory_levels')
        .select(`
          *,
          products:product_id(name, category, product_type)
        `);

      if (selectedLocation !== 'All') {
        query = query.eq('location_name', selectedLocation);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInventory(data || []);
    } catch (err: any) {
      console.error("Error fetching inventory:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchFinancials();
  }, [selectedLocation]);

  const filteredInventory = inventory.filter(item => 
    item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View className="flex-1 bg-slate-900/60 p-6 rounded-[32px] border border-slate-800 backdrop-blur-md">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-indigo-500/10 rounded-2xl items-center justify-center border border-indigo-500/20">
            <Ionicons name="stats-chart" size={20} color="#6366f1" />
          </View>
          <View>
            <Text className="text-white text-lg font-black tracking-tight">Multi-Location Stock Dashboard</Text>
            <Text className="text-slate-400 text-xs font-semibold">Real-time inventory levels across all nodes</Text>
          </View>
        </View>
        <TouchableOpacity 
          className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700"
          onPress={fetchInventory}
        >
          <Ionicons name="refresh" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Filters Bar */}
      <View className="flex-row gap-4 mb-6">
        <View className="flex-1 bg-slate-950/50 rounded-xl border border-slate-800/80 flex-row items-center px-4">
          <Ionicons name="search" size={16} color="#64748b" />
          <TextInput
            placeholder="Search ingredients, materials..."
            placeholderTextColor="#475569"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-white text-sm font-semibold p-3 ml-2 outline-none"
          />
        </View>

        <View className="flex-row bg-slate-950/50 rounded-xl border border-slate-800/80 p-1">
          {['All', 'Central Kitchen', 'Store A', 'Store B'].map((loc) => (
            <TouchableOpacity
              key={loc}
              onPress={() => setSelectedLocation(loc as any)}
              className={`px-4 py-2 rounded-lg justify-center ${selectedLocation === loc ? 'bg-indigo-600' : 'bg-transparent hover:bg-slate-800/50'}`}
            >
              <Text className={`text-xs font-bold ${selectedLocation === loc ? 'text-white' : 'text-slate-400'}`}>
                {loc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Financial Overview (Only show for All or specific logic if needed) */}
      <View className="flex-row gap-4 mb-6">
        <View className="flex-1 bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex-row items-center gap-4">
          <View className="w-12 h-12 bg-emerald-500/10 rounded-xl items-center justify-center border border-emerald-500/20">
            <Ionicons name="cash" size={24} color="#10b981" />
          </View>
          <View>
            <Text className="text-slate-500 text-xs font-bold uppercase mb-1">Total Revenue</Text>
            <Text className="text-emerald-400 text-2xl font-black">RM {(financials.revenue / 100).toFixed(2)}</Text>
          </View>
        </View>
        
        <View className="flex-1 bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex-row items-center gap-4">
          <View className="w-12 h-12 bg-indigo-500/10 rounded-xl items-center justify-center border border-indigo-500/20">
            <Ionicons name="podium" size={24} color="#818cf8" />
          </View>
          <View>
            <Text className="text-slate-500 text-xs font-bold uppercase mb-1">Gross Margin</Text>
            <Text className="text-indigo-400 text-2xl font-black">RM {(financials.margin / 100).toFixed(2)}</Text>
          </View>
        </View>

        <View className="flex-1 bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex-row items-center gap-4">
          <View className="w-12 h-12 bg-rose-500/10 rounded-xl items-center justify-center border border-rose-500/20">
            <Ionicons name="trash-bin" size={24} color="#fb7185" />
          </View>
          <View>
            <Text className="text-slate-500 text-xs font-bold uppercase mb-1">Wastage Cost</Text>
            <Text className="text-rose-400 text-2xl font-black">RM {(financials.writeoffs / 100).toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Main Container */}
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 min-h-[350px]">
        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator color="#6366f1" size="small" />
          </View>
        ) : filteredInventory.length === 0 ? (
          <View className="py-20 items-center justify-center">
            <Ionicons name="cube-outline" size={48} color="#334155" />
            <Text className="text-slate-400 text-sm font-bold mt-3">No inventory records found</Text>
            <Text className="text-slate-600 text-xs text-center font-medium mt-1">
              {searchQuery ? "Try adjusting your search filters" : "Your multi-location tracking is empty."}
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-4">
            {filteredInventory.map((item) => {
              const qty = Number(item.stock_quantity);
              const isLowStock = qty < (item.products?.base_unit === 'g' ? 5000 : 20); // Dynamic threshold
              
              return (
                <View
                  key={item.id}
                  className={`w-[31%] rounded-2xl border p-5 flex flex-col justify-between ${
                    isLowStock 
                      ? 'bg-amber-500/5 border-amber-500/20' 
                      : 'bg-slate-900/40 border-slate-800/60'
                  }`}
                >
                  <View>
                    {/* Location Badge */}
                    <View className="flex-row justify-between items-center mb-3">
                      <View className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">
                        <Text className="text-slate-300 text-[10px] font-black uppercase">
                          {item.location_name}
                        </Text>
                      </View>
                      {item.products?.product_type && (
                        <Text className="text-indigo-400/70 text-[10px] font-bold uppercase">
                          {item.products.product_type}
                        </Text>
                      )}
                    </View>

                    {/* Cargo Info */}
                    <Text className="text-white text-base font-extrabold mb-1 truncate">
                      {item.products?.name || 'Unknown Item'}
                    </Text>
                    <Text className="text-slate-500 text-[10px] font-bold mb-4 uppercase">
                      Category: {item.products?.category || 'Uncategorized'}
                    </Text>
                  </View>

                  {/* Stock Quantity */}
                  <View className={`p-4 rounded-xl border flex-row items-center justify-between ${
                    isLowStock 
                      ? 'bg-amber-950/20 border-amber-500/30' 
                      : 'bg-slate-950/40 border-slate-800/60'
                  }`}>
                    <View className="flex-row items-center gap-2">
                      <Ionicons 
                        name={isLowStock ? "warning" : "cube"} 
                        size={16} 
                        color={isLowStock ? "#f59e0b" : "#6366f1"} 
                      />
                      <Text className={`text-xs font-bold ${isLowStock ? 'text-amber-500' : 'text-slate-400'}`}>
                        {isLowStock ? 'LOW STOCK' : 'In Stock'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className={`text-xl font-black ${isLowStock ? 'text-amber-400' : 'text-white'}`}>
                        {qty.toLocaleString()}
                      </Text>
                      <Text className="text-slate-500 text-[10px] font-bold uppercase mt-0.5">
                        {item.products?.base_unit || 'pcs'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
