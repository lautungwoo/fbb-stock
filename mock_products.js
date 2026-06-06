require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function seedProducts() {
  const mockProducts = [
    { name: 'Strawberry Cake', category: 'Finished Goods', product_type: 'combo', price: 45 },
    { name: 'Chocolate Cake', category: 'Finished Goods', product_type: 'combo', price: 50 },
    { name: 'Premium Flour (kg)', category: 'Raw Materials', product_type: 'standard', price: 3 },
    { name: 'Organic Eggs (dozen)', category: 'Raw Materials', product_type: 'standard', price: 4 },
    { name: 'Cake Box 8-inch', category: 'Packaging', product_type: 'standard', price: 1 },
    { name: 'Fresh Strawberries (kg)', category: 'Raw Materials', product_type: 'standard', price: 12 }
  ];

  console.log('Inserting mock products...');
  
  const { data, error } = await supabase
    .from('products')
    .insert(mockProducts)
    .select();

  if (error) {
    console.error('Error inserting products:', error);
  } else {
    console.log('Successfully inserted products:', data.length);
  }
}

seedProducts();
