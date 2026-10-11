const axios = require('axios');

async function testApi() {
  console.log('Sending request to http://localhost:4000/api/hunt-v2...');
  try {
    const res = await axios.post('http://localhost:4000/api/hunt-v2', {
      niche: 'Digital Marketing',
      location: 'Jaipur',
      page: 1,
      limit: 15
    });

    console.log('Response Status:', res.status);
    console.log('Success:', res.data.success);
    console.log('Total Available:', res.data.totalAvailable);
    console.log('Total This Batch:', res.data.totalThisBatch);
    console.log('Has More:', res.data.hasMore);
    console.log('Duration:', res.data.duration);
    console.log('\nSample Leads returned:');
    res.data.leads.slice(0, 5).forEach((l, i) => {
      console.log(`[${i + 1}] ${l.name}`);
      console.log(`    📞 Phone:   ${l.phone || 'N/A'}`);
      console.log(`    🌐 Website: ${l.website || 'N/A'}`);
      console.log(`    ✉️ Email:   ${l.email || 'N/A'}`);
      console.log(`    📍 Address: ${l.fullAddress}`);
      console.log(`    🗺️ Maps:    ${l.googleMapsUrl}`);
    });
  } catch(e) {
    console.error('API Test Error:', e.response ? e.response.data : e.message);
  }
}

testApi();
