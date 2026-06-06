import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

export default function HQProduction() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProducing, setIsProducing] = useState<string | null>(null);
  
  const [locationName] = useState('Central Kitchen');

  useEffect(() => {
    fetchFinishedGoods();
  }, []);

  const fetchFinishedGoods = async () => {
    setLoading(true);
    try {
      // Only fetch products that act as parents in bill_of_materials
      const { data: bomData, error: bomError } = await supabase
        .from('bill_of_materials')
        .select('parent_product_id');
        
      if (bomError) throw bomError;

      const parentIds = Array.from(new Set(bomData.map((b: any) => b.parent_product_id)));

      if (parentIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('id, name, base_unit, category')
        .in('id', parentIds)
        .order('name');
        
      if (prodErr) throw prodErr;
      
      setProducts(prodData || []);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProduce = async (productId: string, qtyStr: string, clearInput: () => void) => {
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return Alert.alert('Invalid', 'Enter a valid production quantity.');

    setIsProducing(productId);
    try {
      const { error } = await supabase.rpc('complete_production_order', {
        p_finished_product_id: productId,
        p_location_name: locationName,
        p_quantity_produced: qty
      });

      if (error) {
        if (error.message.includes('Insufficient raw materials')) {
           Alert.alert('Production Failed', 'Not enough raw materials in stock to produce this quantity.');
        } else {
           throw error;
        }
      } else {
        Alert.alert('Success', `Successfully produced ${qty} units! Inventory updated.`);
        clearInput();
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setIsProducing(null);
    }
  };

  return (
    <View className="flex-1 bg-slate-900/80 rounded-[32px] border border-slate-700 overflow-hidden flex-col min-h-[500px]">
      <View className="p-6 border-b border-slate-800 bg-slate-900">
         <View className="flex-row items-center gap-4">
           <View className="w-12 h-12 bg-amber-500/10 rounded-2xl items-center justify-center border border-amber-500/20">
             <Ionicons name="construct" size={24} color="#f59e0b" />
           </View>
           <View>
             <Text className="text-white text-2xl font-black mb-1">HQ Production Engine</Text>
             <Text className="text-amber-400/80 font-bold text-xs">Convert Raw Materials into Finished Goods via BOM</Text>
           </View>
         </View>
      </View>

      <View className="flex-1 p-6">
         {loading ? (
           <ActivityIndicator color="#f59e0b" />
         ) : products.length === 0 ? (
           <View className="items-center justify-center py-20">
             <Ionicons name="alert-circle-outline" size={48} color="#64748b" />
             <Text className="text-slate-400 mt-4">No products found with a Bill of Materials.</Text>
           </View>
         ) : (
           <ScrollView showsVerticalScrollIndicator={false}>
             <View className="flex-row flex-wrap gap-4">
               {products.map(p => (
                 <ProductionCard 
                   key={p.id} 
                   product={p} 
                   isProducing={isProducing === p.id} 
                   onProduce={(qty, clear) => handleProduce(p.id, qty, clear)} 
                 />
               ))}
             </View>
           </ScrollView>
         )}
      </View>
    </View>
  );
}

function ProductionCard({ product, isProducing, onProduce }: { product: any, isProducing: boolean, onProduce: (q: string, c: () => void) => void }) {
  const [qty, setQty] = useState('');
  return (
    <View className="w-[31%] bg-slate-950 p-5 rounded-2xl border border-slate-800">
      <Text className="text-white font-bold truncate text-lg mb-1">{product.name}</Text>
      <Text className="text-slate-400 text-xs font-bold uppercase mb-4">{product.category}</Text>
      
      <View className="flex-row gap-2">
        <TextInput 
          placeholder={`Produce Qty (${product.base_unit})`}
          placeholderTextColor="#475569"
          keyboardType="numeric"
          value={qty}
          onChangeText={setQty}
          className="flex-1 bg-slate-900 text-white p-3 rounded-xl border border-slate-800 text-sm focus:border-amber-500" 
        />
        <TouchableOpacity 
          onPress={() => onProduce(qty, () => setQty(''))}
          disabled={!qty || isProducing}
          className={`p-3 rounded-xl items-center justify-center px-4 ${!qty || isProducing ? 'bg-slate-800' : 'bg-amber-600'}`}
        >
          {isProducing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-sm font-bold">Produce</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
