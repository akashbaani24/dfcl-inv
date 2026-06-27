const { createClient } = require('@libsql/client');
const client = createClient({ 
  url: 'libsql://dfcl-inv-akash9090.aws-ap-south-1.turso.io', 
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwNDA0MjUsImlkIjoiMDE5ZWQ0ZmMtZjUwMS03MWIxLThjNDMtMDYxZDcwMTM2YmEzIiwicmlkIjoiYjU2ZTlkYzgtZjZmMC00ZjFkLWI3MjAtZGVlOWFiNWE0ODBkIn0.oqR1cCwNC5Xf5hnEtFQUTjkdwSfwQWVPBAjE5aOcy7czn9TqPUZr1Ej3EXbhZ8_3RKVv99MLQ1NNiRs9rP0lCQ'
});

(async () => {
  const bk = await client.execute('SELECT COUNT(*) as c FROM Booking');
  const bi = await client.execute('SELECT COUNT(*) as c FROM BookingItem');
  console.log('Current bookings:', bk.rows[0].c);
  console.log('Current booking items:', bi.rows[0].c);
  
  const bookings = await client.execute(
    "SELECT b.bookingNo, b.reason, e.name as entityName, " +
    "(SELECT COUNT(*) FROM BookingItem bi WHERE bi.bookingId = b.id) as itemCount " +
    "FROM Booking b JOIN Entity e ON b.entityId = e.id ORDER BY b.bookingDate DESC"
  );
  console.log('');
  console.log('=== Existing bookings ===');
  for (const r of bookings.rows) {
    console.log('  ' + r.bookingNo + ' | ' + r.entityName + ' | items=' + r.itemCount + ' | ' + r.reason);
  }
  
  client.close();
})();
