import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface Product {
  id: string;
  name: string;
  category: string;
  base_unit: string;
}

export default function BlindStocktake() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [physicalCount, setPhysicalCount] = useState('');
  const [location, setLocation] = useState<'Central Kitchen' | 'Store A' | 'Store B'>('Central Kitchen');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, base_unit')
        .order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error("Error fetching products:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSubmit = async () => {
    if (!selectedProduct) return;
    const actualCount = parseInt(physicalCount, 10);
    if (isNaN(actualCount) || actualCount < 0) {
      Alert.alert("Invalid Input", "Please enter a valid positive integer.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Fetch theoretical stock silently
      const { data: levelData, error: levelError } = await supabase
        .from('inventory_levels')
        .select('stock_quantity')
        .eq('product_id', selectedProduct.id)
        .eq('location_name', location)
        .single();

      // If no record exists, theoretical is 0
      const theoreticalStock = levelData ? Number(levelData.stock_quantity) : 0;
      const difference = theoreticalStock - actualCount;

      // 2. If there is a discrepancy, log it
      if (difference !== 0) {
        const { error: discError } = await supabase
          .from('inventory_discrepancies')
          .insert([{
            product_id: selectedProduct.id,
            missing_quantity: difference, // positive means missing, negative means surplus
            reason: `Blind Stocktake diff at ${location}. Physical: ${actualCount}, Theoretical: ${theoreticalStock}`
          }]);
        if (discError) throw discError;
      }

      // 3. Update the inventory level to the actual physical count
      const { error: updateError } = await supabase
        .from('inventory_levels')
        .upsert({
          product_id: selectedProduct.id,
          location_name: location,
          stock_quantity: actualCount,
          last_updated_at: new Date().toISOString()
        }, { onConflict: 'product_id, location_name' });
        
      if (updateError) throw updateError;

      Alert.alert("Stocktake Complete", `Successfully recorded ${actualCount} units for ${selectedProduct.name}.`);
      
      // Reset form
      setSelectedProduct(null);
      setPhysicalCount('');
      setSearchQuery('');
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-900/60 p-6 rounded-[32px] border border-slate-800 backdrop-blur-md">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-rose-500/10 rounded-2xl items-center justify-center border border-rose-500/20">
            <Ionicons name="scan" size={20} color="#f43f5e" />
          </View>
          <View>
            <Text className="text-white text-lg font-black tracking-tight">Blind Stocktake</Text>
            <Text className="text-slate-400 text-xs font-semibold">Count physical items. Theoretical stock is hidden.</Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-6 h-[450px]">
        {/* Left Column: Product Search */}
        <View className="flex-1 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-4">
          <View className="bg-slate-900/80 rounded-xl border border-slate-700/50 flex-row items-center px-4 mb-4">
            <Ionicons name="search" size={16} color="#64748b" />
            <TextInput
              placeholder="Search product to count..."
              placeholderTextColor="#475569"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-white text-sm font-semibold p-3 ml-2 outline-none"
            />
          </View>

          {loading ? (
            <ActivityIndicator color="#f43f5e" size="small" className="mt-10" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredProducts.map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedProduct(p)}
                  className={`p-4 rounded-xl mb-2 flex-row items-center border transition-all ${
                    selectedProduct?.id === p.id 
                      ? 'bg-rose-600/10 border-rose-500/80 shadow-md' 
                      : 'bg-slate-900/40 border-slate-800/40 hover:bg-slate-800/20'
                  }`}
                >
                  <View className="w-8 h-8 bg-slate-800 rounded-lg items-center justify-center mr-3">
                    <Ionicons name="cube-outline" size={16} color="#94a3b8" />
                  </View>
                  <View>
                    <Text className="text-white text-sm font-bold">{p.name}</Text>
                    <Text className="text-slate-500 text-[10px] font-semibold mt-0.5 uppercase">{p.category}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Right Column: Count Entry */}
        <View className="w-[340px] bg-slate-950/40 rounded-2xl border border-slate-800/60 p-5">
          {selectedProduct ? (
            <View className="flex-1 justify-between">
              <View>
                <Text className="text-slate-400 text-xs font-extrabold uppercase tracking-wider mb-4">
                  Physical Count Entry
                </Text>

                <View className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mb-6">
                  <Text className="text-slate-500 text-[10px] font-bold uppercase mb-1">Selected Item</Text>
                  <Text className="text-white text-lg font-black mb-1">{selectedProduct.name}</Text>
                  <Text className="text-rose-400 text-xs font-bold">{selectedProduct.category}</Text>
                </View>

                {/* Location Selection */}
                <Text className="text-slate-500 text-[10px] font-bold uppercase mb-2">Location</Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {['Central Kitchen', 'Store A', 'Store B'].map(loc => (
                    <TouchableOpacity
                      key={loc}
                      onPress={() => setLocation(loc as any)}
                      className={`px-3 py-2 rounded-lg border ${
                        location === loc ? 'bg-rose-600 border-rose-500' : 'bg-slate-800/50 border-slate-700/50'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${location === loc ? 'text-white' : 'text-slate-400'}`}>
                        {loc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Blind Count Input */}
                <Text className="text-slate-500 text-[10px] font-bold uppercase mb-2">
                  Actual Physical Count ({selectedProduct.base_unit || 'pcs'})
                </Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#475569"
                  value={physicalCount}
                  onChangeText={setPhysicalCount}
                  className="bg-slate-900 text-white text-3xl font-black p-4 rounded-xl border border-slate-700 text-center focus:border-rose-500"
                />
                <Text className="text-slate-500 text-[10px] text-center mt-2 font-medium">
                  Count in minimum integer unit ({selectedProduct.base_unit || 'pcs'}).
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !physicalCount}
                className={`w-full py-4 rounded-xl items-center justify-center flex-row gap-2 border ${
                  submitting || !physicalCount
                    ? 'bg-slate-800 border-slate-700/50 opacity-50'
                    : 'bg-rose-600 border-rose-500/50 active:bg-rose-700'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color="white" />
                    <Text className="text-white text-sm font-black">Submit Count</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center p-6">
              <View className="w-16 h-16 bg-slate-900/60 rounded-full border border-slate-800 items-center justify-center mb-4">
                <Ionicons name="barcode-outline" size={28} color="#475569" />
              </View>
              <Text className="text-slate-400 text-base font-bold text-center">Scan or Select</Text>
              <Text className="text-slate-600 text-xs text-center font-medium mt-2 leading-5">
                Select an item from the left panel to begin physical stock counting.
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
