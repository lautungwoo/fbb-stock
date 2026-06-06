import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface Product {
  id: string;
  name: string;
  category: string;
  product_type: string;
  price_cents: number;
  base_unit: string;
}

interface BomIngredient {
  id: string;
  ingredient_product_id: string;
  quantity_required: number; // Stored as integer
  ingredient?: {
    name: string;
    base_unit: string;
  };
}

export default function ProductCatalog() {
  const [filter, setFilter] = useState<'All' | 'Raw Materials' | 'Finished Goods' | 'Packaging'>('All');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // BOM Editor State
  const [bomItems, setBomItems] = useState<BomIngredient[]>([]);
  const [loadingBom, setLoadingBom] = useState(false);
  const [newIngredientSearch, setNewIngredientSearch] = useState('');
  const [newIngredientQty, setNewIngredientQty] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct && selectedProduct.category === 'Finished Goods') {
      fetchBom(selectedProduct.id);
    } else {
      setBomItems([]);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (newIngredientSearch.length > 1) {
      const results = products.filter(p => 
        p.id !== selectedProduct?.id && 
        p.name.toLowerCase().includes(newIngredientSearch.toLowerCase())
      );
      setSearchResults(results.slice(0, 5));
    } else {
      setSearchResults([]);
    }
  }, [newIngredientSearch]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBom = async (productId: string) => {
    setLoadingBom(true);
    try {
      const { data, error } = await supabase
        .from('product_bom')
        .select(`
          id,
          ingredient_product_id,
          quantity_required,
          ingredient:products!product_bom_ingredient_product_id_fkey(name, base_unit)
        `)
        .eq('parent_product_id', productId);
        
      if (error) throw error;
      setBomItems(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingBom(false);
    }
  };

  const addBomItem = async () => {
    if (!selectedProduct || !selectedIngredient) return;
    
    const qty = parseInt(newIngredientQty, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid Input", "Quantity must be a positive integer.");
      return;
    }

    try {
      const { error } = await supabase
        .from('product_bom')
        .insert([{
          parent_product_id: selectedProduct.id,
          ingredient_product_id: selectedIngredient.id,
          quantity_required: qty
        }]);

      if (error) throw error;
      
      // Refresh BOM
      setNewIngredientSearch('');
      setNewIngredientQty('');
      setSelectedIngredient(null);
      fetchBom(selectedProduct.id);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const removeBomItem = async (bomId: string) => {
    try {
      const { error } = await supabase.from('product_bom').delete().eq('id', bomId);
      if (error) throw error;
      setBomItems(prev => prev.filter(b => b.id !== bomId));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const filteredProducts = products.filter(p => filter === 'All' || p.category === filter);

  return (
    <View className="flex-1 flex-row bg-slate-900/60 rounded-[32px] border border-slate-800 backdrop-blur-md overflow-hidden min-h-[600px]">
      
      {/* Left Column: Data Table Catalog */}
      <View className="flex-1 p-6 flex-col">
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-indigo-500/10 rounded-2xl items-center justify-center border border-indigo-500/20">
              <Ionicons name="list" size={20} color="#6366f1" />
            </View>
            <View>
              <Text className="text-white text-lg font-black tracking-tight">Master Catalog</Text>
              <Text className="text-slate-400 text-xs font-semibold">Manage SKUs, Pricing, and Recipes</Text>
            </View>
          </View>
          <TouchableOpacity onPress={fetchProducts} className="p-2 bg-slate-800 rounded-xl hover:bg-slate-700">
            <Ionicons name="refresh" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View className="flex-row gap-2 mb-4 bg-slate-950/50 p-1.5 rounded-xl border border-slate-800 self-start">
          {['All', 'Raw Materials', 'Finished Goods', 'Packaging'].map(f => (
            <TouchableOpacity 
              key={f} 
              onPress={() => setFilter(f as any)} 
              className={`px-4 py-2 rounded-lg ${filter === f ? 'bg-indigo-600' : 'bg-transparent'}`}
            >
              <Text className={`text-xs font-bold ${filter === f ? 'text-white' : 'text-slate-400'}`}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Minimalist Data Table */}
        {loading ? (
          <ActivityIndicator color="#6366f1" size="small" className="mt-10" />
        ) : (
          <FlatList 
            data={filteredProducts}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => setSelectedProduct(item)} 
                className={`p-4 border-b border-slate-800/60 flex-row justify-between items-center transition-all ${
                  selectedProduct?.id === item.id ? 'bg-indigo-900/20 border-indigo-500/30' : 'hover:bg-slate-800/30'
                }`}
              >
                <View>
                  <Text className="text-white text-sm font-bold">{item.name}</Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <Text className="text-slate-500 text-[10px] font-bold uppercase">{item.category}</Text>
                    <View className="w-1 h-1 bg-slate-700 rounded-full" />
                    <Text className="text-indigo-400 text-[10px] font-bold uppercase">{item.product_type}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-slate-300 text-sm font-black">
                    RM {((Number(item.price_cents) || 0) / 100).toFixed(2)}
                  </Text>
                  <Text className="text-slate-500 text-[10px] font-bold mt-1">
                    per {item.base_unit || 'pcs'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Right Column: Slide-over Recipe Editor (Only for Finished Goods) */}
      {selectedProduct && selectedProduct.category === 'Finished Goods' && (
        <View className="w-[420px] bg-slate-950 p-6 border-l border-slate-800 shadow-2xl flex-col">
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-white text-lg font-black">BOM Configuration</Text>
              <Text className="text-indigo-400 text-xs font-bold">{selectedProduct.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedProduct(null)} className="p-2 bg-slate-900 rounded-full">
              <Ionicons name="close" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Minimalist Entry Form */}
          <View className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 mb-6 z-50">
            <Text className="text-slate-500 text-[10px] font-bold uppercase mb-3">Add Ingredient</Text>
            
            <View className="flex-row gap-2 mb-2">
              <View className="flex-1 relative">
                <TextInput 
                  placeholder="Search SKU..." 
                  placeholderTextColor="#475569"
                  value={selectedIngredient ? selectedIngredient.name : newIngredientSearch}
                  onChangeText={txt => {
                    setSelectedIngredient(null);
                    setNewIngredientSearch(txt);
                  }}
                  className="bg-slate-950 text-white text-xs font-semibold p-3 rounded-lg border border-slate-800 outline-none"
                />
                {/* Search Dropdown (Inline to prevent Web Touch issues) */}
                {searchResults.length > 0 && !selectedIngredient && (
                  <View className="bg-slate-800 border border-slate-700 rounded-lg mt-1 overflow-hidden shadow-xl">
                    {searchResults.map(res => (
                      <TouchableOpacity 
                        key={res.id} 
                        onPress={() => {
                          setSelectedIngredient(res);
                          setSearchResults([]);
                          setNewIngredientSearch('');
                        }}
                        className="p-3 border-b border-slate-700/50 hover:bg-slate-700"
                      >
                        <Text className="text-white text-xs font-bold">{res.name}</Text>
                        <Text className="text-slate-400 text-[10px] mt-0.5">({res.base_unit || 'pcs'})</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TextInput 
                placeholder="Qty (Integer)" 
                placeholderTextColor="#475569"
                keyboardType="numeric" 
                value={newIngredientQty}
                onChangeText={setNewIngredientQty}
                className="w-24 bg-slate-950 text-white text-xs font-semibold p-3 rounded-lg border border-slate-800 outline-none text-center" 
              />
            </View>

            <TouchableOpacity 
              onPress={addBomItem}
              disabled={!selectedIngredient || !newIngredientQty}
              className={`py-3 rounded-lg items-center justify-center ${
                (!selectedIngredient || !newIngredientQty) ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <Text className="text-white text-xs font-bold">Assign to Recipe</Text>
            </TouchableOpacity>
          </View>

          {/* BOM List */}
          <Text className="text-slate-500 text-[10px] font-bold uppercase mb-3">Current Recipe Components</Text>
          {loadingBom ? (
            <ActivityIndicator color="#6366f1" size="small" />
          ) : bomItems.length === 0 ? (
            <View className="py-10 items-center justify-center border border-dashed border-slate-800 rounded-xl">
              <Text className="text-slate-500 text-xs font-medium">No ingredients configured yet.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {bomItems.map(item => (
                <View key={item.id} className="flex-row justify-between items-center bg-slate-900 p-4 rounded-xl mb-2 border border-slate-800/50">
                  <View>
                    <Text className="text-white text-sm font-bold">{item.ingredient?.name}</Text>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <View className="items-end">
                      <Text className="text-indigo-400 text-sm font-black">{item.quantity_required}</Text>
                      <Text className="text-slate-500 text-[10px] font-bold">{item.ingredient?.base_unit || 'pcs'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeBomItem(item.id)} className="p-2 bg-rose-500/10 rounded-lg hover:bg-rose-500/20">
                      <Ionicons name="trash-outline" size={14} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

    </View>
  );
}
