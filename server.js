/**
 * Server for ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย
 * ฝ่ายเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลร้องกวาง
 * Created by Pattaraporn Wongjak
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets and frontend
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย',
    organization: 'ฝ่ายเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลร้องกวาง',
    createdBy: 'Pattaraporn Wongjak',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log('================================================================');
  console.log('  ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย');
  console.log('  ฝ่ายเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลร้องกวาง');
  console.log('  Created by Pattaraporn Wongjak');
  console.log('================================================================');
  console.log(`  ✓ ระบบกำลังทำงานที่: http://localhost:${PORT}`);
  console.log('  ✓ เปิดเบราว์เซอร์แล้วเข้าใช้งานได้ทันที');
  console.log('================================================================');
});
