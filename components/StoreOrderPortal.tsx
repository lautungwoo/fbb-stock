import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

interface StoreProps {
  id: string;
  name: string;
}

export default function StoreOrderPortal({ currentStore }: { currentStore: StoreProps | null }) {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<{ product: any; qty: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<'new' | 'history'>('new');
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [prodRes, invRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .in('category', ['Finished Goods', 'Packaging'])
          .order('name'),
        supabase
          .from('inventory_levels')
          .select('product_id, stock_quantity, min_stock_level')
          .eq('location_name', currentStore.name)
      ]);

      if (prodRes.error) throw prodRes.error;
      if (invRes.error) throw invRes.error;

      const invMap: Record<string, { stock: number; min: number }> = {};
      invRes.data?.forEach(row => {
        invMap[row.product_id] = { stock: row.stock_quantity, min: row.min_stock_level || 0 };
      });

      const merged = (prodRes.data || []).map(p => ({
        ...p,
        currentStock: invMap[p.id]?.stock || 0,
        minStock: invMap[p.id]?.min || 0
      }));

      setProducts(merged);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryOrders = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_orders')
        .select(`
          *,
          store_order_items (
            quantity_requested,
            unit_price_cents,
            products (name)
          )
        `)
        .eq('store_id', currentStore.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistoryOrders(data || []);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'history') {
      fetchHistoryOrders();
    }
  }, [activeView, currentStore]);

  const handleAutoFillCart = () => {
    const lowStockItems = products.filter(p => p.minStock > 0 && p.currentStock <= p.minStock);
    if (lowStockItems.length === 0) return Alert.alert("All Good!", "No items are below their safety stock level.");

    setCart(prev => {
      const newCart = [...prev];
      lowStockItems.forEach(p => {
        const deficit = p.minStock - p.currentStock;
        if (deficit > 0) {
          const existing = newCart.find(item => item.product.id === p.id);
          if (existing) {
             existing.qty = (parseInt(existing.qty, 10) + deficit).toString();
          } else {
             newCart.push({ product: p, qty: deficit.toString() });
          }
        }
      });
      return newCart;
    });
    Alert.alert("Cart Filled", `Added ${lowStockItems.length} low stock items to your cart.`);
  };

  const handleAddToCart = (product: any, qtyString: string) => {
    const qty = parseInt(qtyString, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid positive integer.');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: (parseInt(item.qty, 10) + qty).toString() } : item);
      }
      return [...prev, { product, qty: qty.toString() }];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const submitOrder = async () => {
    if (!currentStore) return Alert.alert("Error", "No store selected.");
    if (cart.length === 0) return Alert.alert("Cart Empty", "Please add items to cart.");
    
    setIsSubmitting(true);
    try {
      let total_cents = 0;
      for (const item of cart) {
        total_cents += (item.product.price_cents || 0) * parseInt(item.qty, 10);
      }

      // 1. Insert store_order
      const { data: orderData, error: orderError } = await supabase
        .from('store_orders')
        .insert([{ store_id: currentStore.id, status: 'PENDING', total_cents }])
        .select()
        .single();
      
      if (orderError) throw orderError;

      // 2. Insert items
      const itemsToInsert = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity_requested: parseInt(item.qty, 10),
        unit_price_cents: item.product.price_cents || 0
      }));

      const { error: itemsError } = await supabase
        .from('store_order_items')
        .insert(itemsToInsert);
      
      if (itemsError) throw itemsError;

      Alert.alert("Success", "Order submitted successfully!");
      setCart([]);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Submission Failed", e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentStore) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900/60 rounded-[32px] border border-slate-800">
        <Text className="text-white font-bold">Please select a Store from the top dropdown to place an order.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900/60 rounded-[32px] border border-slate-800 overflow-hidden min-h-[600px] flex-col">
       
       {/* Header with Toggle */}
       <View className="flex-row justify-between items-center p-6 border-b border-slate-800">
         <View>
           <Text className="text-white text-2xl font-black mb-1">Store Ordering Portal</Text>
           <Text className="text-slate-400 font-bold">Ordering as: <Text className="text-indigo-400">{currentStore.name}</Text></Text>
         </View>
         <View className="flex-row bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <TouchableOpacity 
              onPress={() => setActiveView('new')}
              className={`px-6 py-2 rounded-lg ${activeView === 'new' ? 'bg-indigo-600' : 'bg-transparent'}`}
            >
              <Text className={`text-xs font-bold ${activeView === 'new' ? 'text-white' : 'text-slate-400'}`}>New Order</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveView('history')}
              className={`px-6 py-2 rounded-lg ${activeView === 'history' ? 'bg-indigo-600' : 'bg-transparent'}`}
            >
              <Text className={`text-xs font-bold ${activeView === 'history' ? 'text-white' : 'text-slate-400'}`}>Order History</Text>
            </TouchableOpacity>
          </View>
       </View>

       {activeView === 'new' ? (
         <View className="flex-1 flex-row">
           {/* Left Column: Product Grid */}
           <View className="flex-1 p-6">
              
              {/* Low Stock Banner */}
              {products.some(p => p.minStock > 0 && p.currentStock <= p.minStock) && (
                <View className="bg-rose-500/20 border border-rose-500/50 rounded-2xl p-4 mb-6 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="warning" size={24} color="#fb7185" />
                    <View>
                      <Text className="text-rose-400 font-black text-sm">Low Stock Alert!</Text>
                      <Text className="text-rose-300/80 text-xs mt-0.5">Some items are below their safety par level.</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={handleAutoFillCart}
                    className="bg-rose-600 px-4 py-2 rounded-xl flex-row items-center gap-2 hover:bg-rose-500"
                  >
                    <Ionicons name="flash" size={14} color="white" />
                    <Text className="text-white font-bold text-xs">1-Click Fill Cart</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View className="flex-row flex-wrap gap-4">
                 {loading ? (
                   <Text className="text-slate-500">Loading catalog...</Text>
                 ) : (
                   products.map(product => (
                     <ProductCard key={product.id} product={product} onAdd={handleAddToCart} />
                   ))
                 )}
              </View>
           </View>

       {/* Right Column: Cart */}
       <View className="w-80 bg-slate-950 p-6 border-l border-slate-800 flex-col">
          <Text className="text-white text-xl font-black mb-4">Your Cart</Text>
          
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {cart.length === 0 ? (
              <Text className="text-slate-500 italic text-sm">Cart is empty...</Text>
            ) : (
              cart.map((item, idx) => (
                <View key={idx} className="flex-row justify-between items-center bg-slate-900 p-3 rounded-xl mb-2 border border-slate-800">
                  <View className="flex-1">
                    <Text className="text-white font-bold text-sm" numberOfLines={1}>{item.product.name}</Text>
                    <Text className="text-slate-500 text-[10px]">RM {(((item.product.price_cents || 0) * parseInt(item.qty, 10)) / 100).toFixed(2)}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-indigo-400 font-black">{item.qty} {item.product.base_unit || 'pcs'}</Text>
                    <TouchableOpacity onPress={() => handleRemoveFromCart(item.product.id)}>
                      <Ionicons name="trash-outline" size={14} color="#f43f5e" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View className="mt-4 pt-4 border-t border-slate-800 flex-row justify-between items-center mb-4">
             <Text className="text-slate-400 font-bold">Total</Text>
             <Text className="text-white text-xl font-black">
               RM {(cart.reduce((sum, item) => sum + (item.product.price_cents || 0) * parseInt(item.qty, 10), 0) / 100).toFixed(2)}
             </Text>
          </View>

          <TouchableOpacity 
             onPress={submitOrder} 
             disabled={isSubmitting || cart.length === 0}
             className={`p-4 rounded-xl items-center justify-center ${isSubmitting || cart.length === 0 ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
             <Text className="text-white font-bold text-base">{isSubmitting ? 'Submitting...' : 'Submit Order'}</Text>
           </TouchableOpacity>
        </View>
      </View>
     ) : (
       /* Order History View */
       <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
         {loading ? (
            <Text className="text-slate-500 text-center py-10">Loading history...</Text>
         ) : historyOrders.length === 0 ? (
            <Text className="text-slate-500 text-center py-10">No past orders found.</Text>
         ) : (
            historyOrders.map(order => (
              <View key={order.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-slate-400 font-bold text-xs">{new Date(order.created_at).toLocaleString()}</Text>
                  <View className={`px-3 py-1 rounded-full ${
                    order.status === 'PENDING' ? 'bg-amber-500/20 border border-amber-500/30' :
                    order.status === 'DISPATCHED' ? 'bg-emerald-500/20 border border-emerald-500/30' :
                    order.status === 'REJECTED' ? 'bg-rose-500/20 border border-rose-500/30' :
                    'bg-slate-800'
                  }`}>
                    <Text className={`text-[10px] font-black uppercase ${
                      order.status === 'PENDING' ? 'text-amber-400' :
                      order.status === 'DISPATCHED' ? 'text-emerald-400' :
                      order.status === 'REJECTED' ? 'text-rose-400' :
                      'text-slate-400'
                    }`}>
                      {order.status}
                    </Text>
                  </View>
                </View>
                
                <Text className="text-white text-lg font-black mb-2">Total: RM {(order.total_cents / 100).toFixed(2)}</Text>
                
                <View className="bg-slate-900 rounded-xl p-3 border border-slate-800/80 mt-2">
                  <Text className="text-slate-500 text-[10px] font-bold uppercase mb-2">Order Items:</Text>
                  {order.store_order_items.map((item: any, idx: number) => (
                    <View key={idx} className="flex-row justify-between mb-1">
                      <Text className="text-slate-300 text-xs">- {item.products?.name}</Text>
                      <Text className="text-indigo-400 font-bold text-xs">x{item.quantity_requested}</Text>
                    </View>
                  ))}
                </View>

                {order.status === 'REJECTED' && (
                  <View className="mt-3 p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl">
                    <Text className="text-rose-400 text-xs font-bold">⚠️ This order was rejected by HQ and will not be fulfilled.</Text>
                  </View>
                )}
              </View>
            ))
         )}
       </ScrollView>
     )}
    </View>
  );
}

// Subcomponent for Product Card to encapsulate state
function ProductCard({ product, onAdd }: { product: any, onAdd: (p: any, q: string) => void }) {
  const [qty, setQty] = useState('');
  return (
     <View className="w-[30%] p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:bg-slate-800">
       <Text className="text-white font-bold mb-1 truncate">{product.name}</Text>
       <View className="flex-row items-center justify-between mb-3">
         <Text className="text-slate-400 text-xs">{product.category}</Text>
         <Text className="text-indigo-400 text-xs font-bold">RM {((product.price_cents || 0) / 100).toFixed(2)}</Text>
       </View>
       
       <View className="bg-slate-900/50 rounded-lg p-2 mb-3 border border-slate-700/50 flex-row justify-between">
         <View>
           <Text className="text-slate-500 text-[10px] uppercase font-bold">Current</Text>
           <Text className={`font-black ${product.currentStock <= product.minStock && product.minStock > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{product.currentStock || 0}</Text>
         </View>
         <View className="items-end">
           <Text className="text-slate-500 text-[10px] uppercase font-bold">Par Level</Text>
           <Text className="text-slate-400 font-bold">{product.minStock || 0}</Text>
         </View>
       </View>

       <View className="flex-row gap-2">
         <TextInput 
           placeholder={`Qty (${product.base_unit || 'pcs'})`}
           placeholderTextColor="#64748b"
           keyboardType="numeric"
           value={qty}
           onChangeText={setQty}
           className="flex-1 bg-slate-900 text-white p-2 rounded-lg border border-slate-700 text-xs text-center focus:border-indigo-500" 
         />
         <TouchableOpacity 
           onPress={() => { onAdd(product, qty); setQty(''); }}
           disabled={!qty}
           className={`p-2 rounded-lg items-center justify-center px-4 ${!qty ? 'bg-slate-700' : 'bg-indigo-600'}`}
         >
           <Text className="text-white text-xs font-bold">Add</Text>
         </TouchableOpacity>
       </View>
     </View>
  );
}
