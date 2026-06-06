import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StatusBar, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import DispatchComponent from '../components/DispatchComponent';
import ReceivingRadar from '../components/ReceivingRadar';
import InventoryDashboard from '../components/InventoryDashboard';
import BlindStocktake from '../components/BlindStocktake';
import ProductCatalog from '../components/ProductCatalog';
import StoreOrderPortal from '../components/StoreOrderPortal';
import HQFulfillment from '../components/HQFulfillment';
import StorePOS from '../components/StorePOS';
import StoreWastage from '../components/StoreWastage';
import MarketPacking from '../components/MarketPacking';
import HQProduction from '../components/HQProduction';

// Feature Flag for Dark Launching
const ENABLE_HQ_PRODUCTION = false;

export type RoleContext = {
  type: 'HQ Admin' | 'Store Manager';
  store?: { id: string; name: string };
};

export default function IndexScreen() {
  const [activeTab, setActiveTab] = useState<'all' | 'packing' | 'dashboard' | 'stocktake' | 'catalog' | 'order' | 'fulfill' | 'pos' | 'wastage' | 'production'>('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Dev Mode Context
  const [stores, setStores] = useState<{id: string; name: string}[]>([]);
  const [currentRole, setCurrentRole] = useState<RoleContext>({ type: 'HQ Admin' });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data } = await supabase.from('stores').select('*').order('name');
      if (data) setStores(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshAll = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19] text-white">
      <StatusBar barStyle="light-content" backgroundColor="#0b0f19" />
      
      {/* Premium Top Navigation Bar */}
      <View className="flex-row justify-between items-center px-8 py-5 bg-[#0f172a]/80 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-50">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-indigo-600 rounded-xl items-center justify-center border border-indigo-400/30">
            <Ionicons name="cube" size={22} color="white" />
          </View>
          <View>
            <Text className="text-white text-xl font-extrabold tracking-tight">Fuufoo Stock App</Text>
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">FuufoonBites Supply Chain Hub</Text>
          </View>
        </View>

        {/* Dev Mode Role Toggle */}
        <View className="relative z-50">
          <TouchableOpacity 
            className="flex-row items-center gap-2 bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl"
            onPress={() => setShowRoleDropdown(!showRoleDropdown)}
          >
            <Ionicons name="person-circle" size={18} color="#818cf8" />
            <Text className="text-white font-bold text-xs">
              {currentRole.type === 'HQ Admin' ? 'HQ Admin' : `${currentRole.store?.name} Manager`}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#94a3b8" />
          </TouchableOpacity>

          {showRoleDropdown && (
            <View className="absolute top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden py-1">
              <Text className="text-slate-500 text-[10px] font-bold uppercase px-3 py-1 mt-1">HQ Roles</Text>
              <TouchableOpacity 
                className="px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50"
                onPress={() => { setCurrentRole({ type: 'HQ Admin' }); setShowRoleDropdown(false); setActiveTab('fulfill'); }}
              >
                <Text className="text-white font-bold text-xs">HQ Admin</Text>
              </TouchableOpacity>
              
              <Text className="text-slate-500 text-[10px] font-bold uppercase px-3 py-1 mt-2">Franchisee & Pop-up Roles</Text>
              {stores.map(store => (
                <TouchableOpacity 
                  key={store.id}
                  className="px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50"
                  onPress={() => { setCurrentRole({ type: 'Store Manager', store }); setShowRoleDropdown(false); setActiveTab('pos'); }}
                >
                  <Text className="text-white font-bold text-xs">{store.name} Manager</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Responsive Desktop Tab Filters */}
        <View className="flex-row bg-[#020617] p-1.5 rounded-2xl border border-slate-800/80 overflow-hidden">
          {currentRole.type === 'HQ Admin' ? (
            <>
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'fulfill' ? 'bg-indigo-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('fulfill')}
              >
                <Ionicons name="file-tray-full" size={14} color="white" />
                <Text className="text-white text-xs font-black">Fulfillment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'catalog' ? 'bg-indigo-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('catalog')}
              >
                <Ionicons name="list" size={14} color="white" />
                <Text className="text-white text-xs font-black">Catalog</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'dashboard' ? 'bg-indigo-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('dashboard')}
              >
                <Ionicons name="stats-chart" size={14} color="white" />
                <Text className="text-white text-xs font-black">Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'stocktake' ? 'bg-indigo-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('stocktake')}
              >
                <Ionicons name="scan" size={14} color="white" />
                <Text className="text-white text-xs font-black">Stocktake</Text>
              </TouchableOpacity>
              <View className="w-px h-6 bg-slate-800 my-auto mx-1" />
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'packing' ? 'bg-indigo-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('packing')}
              >
                <Ionicons name="briefcase-outline" size={14} color="white" />
                <Text className="text-white text-xs font-black">Pop-up Packing</Text>
              </TouchableOpacity>
              
              {ENABLE_HQ_PRODUCTION && (
                <TouchableOpacity 
                  className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'production' ? 'bg-amber-600' : 'bg-transparent'}`}
                  onPress={() => setActiveTab('production')}
                >
                  <Ionicons name="construct" size={14} color="white" />
                  <Text className="text-white text-xs font-black">Production</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'pos' ? 'bg-emerald-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('pos')}
              >
                <Ionicons name="cash" size={14} color="white" />
                <Text className="text-white text-xs font-black">POS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'wastage' ? 'bg-emerald-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('wastage')}
              >
                <Ionicons name="trash" size={14} color="white" />
                <Text className="text-white text-xs font-black">Wastage</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`px-3 py-2 rounded-xl flex-row items-center gap-1.5 ${activeTab === 'order' ? 'bg-emerald-600' : 'bg-transparent'}`}
                onPress={() => setActiveTab('order')}
              >
                <Ionicons name="cart" size={14} color="white" />
                <Text className="text-white text-xs font-black">Place Order</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity 
          className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700/50 hover:bg-slate-700 active:bg-slate-900 flex-row items-center gap-2"
          onPress={handleRefreshAll}
        >
          <Ionicons name="refresh-circle-outline" size={18} color="#94a3b8" />
          <Text className="text-slate-300 text-xs font-bold">Sync Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Main Dashboard Layout */}
      <ScrollView 
        className="flex-1 px-8 pt-8"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Notification / Alert Bar */}
        <View className="bg-indigo-950/20 border border-indigo-500/20 px-6 py-4 rounded-3xl mb-8 flex-row items-center gap-3">
          <View className="w-8 h-8 bg-indigo-500/10 rounded-lg items-center justify-center">
            <Ionicons name="information-circle" size={16} color="#6366f1" />
          </View>
          <View className="flex-1">
            <Text className="text-indigo-300 text-xs font-black">Pop-up Market Mode Active</Text>
            <Text className="text-slate-400 text-[10px] font-medium leading-4 mt-0.5">
              The multi-store transit radar is currently paused. Use the "Pop-up Packing" tab to rapidly transfer inventory from HQ directly to pop-up locations.
            </Text>
          </View>
        </View>

        {/* Dynamic Panels Layout based on selected Tab */}
        
        {activeTab === 'packing' && (
          <View className="max-w-[900px] mx-auto w-full">
            <MarketPacking key={`packing-${refreshTrigger}`} />
          </View>
        )}

        {ENABLE_HQ_PRODUCTION && activeTab === 'production' && (
          <View className="max-w-[900px] mx-auto w-full">
            <HQProduction key={`prod-${refreshTrigger}`} />
          </View>
        )}

        {activeTab === 'pos' && (
          <View className="max-w-[720px] mx-auto w-full">
            <StorePOS key={`pos-${refreshTrigger}`} storeName={currentRole.store?.name || ''} />
          </View>
        )}

        {activeTab === 'wastage' && (
          <View className="max-w-[720px] mx-auto w-full">
            <StoreWastage key={`wastage-${refreshTrigger}`} storeName={currentRole.store?.name || ''} />
          </View>
        )}

        {activeTab === 'dashboard' && (
          <View className="w-full">
            <InventoryDashboard key={`dashboard-${refreshTrigger}`} />
          </View>
        )}

        {activeTab === 'catalog' && (
          <View className="w-full">
            <ProductCatalog key={`catalog-${refreshTrigger}`} />
          </View>
        )}

        {activeTab === 'order' && currentRole.type === 'Store Manager' && (
          <View className="w-full">
            <StoreOrderPortal key={`order-${refreshTrigger}`} currentStore={currentRole.store || null} />
          </View>
        )}

        {activeTab === 'fulfill' && currentRole.type === 'HQ Admin' && (
          <View className="w-full">
            <HQFulfillment key={`fulfill-${refreshTrigger}`} onFulfillSuccess={handleRefreshAll} />
          </View>
        )}

        {activeTab === 'stocktake' && (
          <View className="max-w-[900px] mx-auto w-full">
            <BlindStocktake key={`stocktake-${refreshTrigger}`} />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
