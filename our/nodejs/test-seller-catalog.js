const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';

async function testSellerCatalog() {
  console.log('Testing Seller Catalog Endpoints...\n');

  try {
    // Test 1: Get seller information
    console.log('1. Testing GET /sellers/:sellerId');
    const sellerId = 1; // Assuming seller with ID 1 exists
    const sellerResponse = await axios.get(`${BASE_URL}/sellers/${sellerId}`);
    console.log('✅ Seller info:', sellerResponse.data);

    // Test 2: Get seller products
    console.log('\n2. Testing GET /sellers/:sellerId/products');
    const productsResponse = await axios.get(`${BASE_URL}/sellers/${sellerId}/products?page=1`);
    console.log('✅ Seller products:', productsResponse.data);

    // Test 3: Get seller products count
    console.log('\n3. Testing GET /sellers/:sellerId/products/count');
    const countResponse = await axios.get(`${BASE_URL}/sellers/${sellerId}/products/count`);
    console.log('✅ Products count:', countResponse.data);

    // Test 4: Get categories
    console.log('\n4. Testing GET /seller/categories');
    const categoriesResponse = await axios.get(`${BASE_URL}/seller/categories`);
    console.log('✅ Categories:', categoriesResponse.data);

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testSellerCatalog(); 