/**
 * Excel & CSV Import/Export Service using SheetJS (xlsx)
 * ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย โรงพยาบาลร้องกวาง
 * Created by Pattaraporn Wongjak
 */

const ExcelService = {
  /**
   * Export Return Items to Excel (.xlsx) with formatting and total summary row
   */
  async exportReturnsToExcel(items, { title = 'รายงานการรับยาคืน', dateRange = '', source = '' } = {}) {
    if (typeof XLSX === 'undefined') {
      alert('ไม่พบไลบรารี XLSX กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      return;
    }

    // Build data rows
    const data = [
      ['ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย - ฝ่ายเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลร้องกวาง'],
      [`Created by Pattaraporn Wongjak | ส่งออกข้อมูลเมื่อ: ${ThaiDate.formatFull(ThaiDate.todayISO())}`],
      [dateRange ? `ช่วงวันที่: ${dateRange}` : 'ช่วงวันที่: ทั้งหมด', source ? `แหล่งที่มา: ${source}` : 'แหล่งที่มา: ทั้งหมด'],
      [], // Empty row separator
      [
        'ลำดับ',
        'วันที่รับคืน (พ.ศ.)',
        'แหล่งที่มา',
        'รหัสยา',
        'รายการยา',
        'Generic Name',
        'Dosage Form',
        'จำนวน',
        'ต้นทุนต่อหน่วย (บาท)',
        'มูลค่ารวม (บาท)'
      ]
    ];

    let totalQuantity = 0;
    let totalValue = 0;

    items.forEach((item, index) => {
      totalQuantity += item.quantity;
      totalValue += item.total_value;

      data.push([
        index + 1,
        ThaiDate.formatShort(item.return_date),
        item.source,
        item.drug_code || '-',
        item.drug_name,
        item.generic_name || '-',
        item.dosage_form || '-',
        item.quantity,
        Number(item.unit_cost.toFixed(2)),
        Number(item.total_value.toFixed(2))
      ]);
    });

    // Summary Row
    data.push([]);
    data.push([
      '',
      'รวมทั้งสิ้น',
      '',
      '',
      '',
      '',
      `${items.length} รายการ`,
      totalQuantity,
      '',
      Number(totalValue.toFixed(2))
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    worksheet['!cols'] = [
      { wch: 8 },  // ลำดับ
      { wch: 18 }, // วันที่
      { wch: 18 }, // แหล่งที่มา
      { wch: 12 }, // รหัสยา
      { wch: 30 }, // รายการยา
      { wch: 25 }, // Generic name
      { wch: 15 }, // Dosage form
      { wch: 12 }, // จำนวน
      { wch: 20 }, // ต้นทุนต่อหน่วย
      { wch: 20 }  // มูลค่ารวม
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานยาคืน');

    const fileName = `รายงานการรับยาคืน_รพ_ร้องกวาง_${ThaiDate.todayISO().replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  },

  /**
   * Parse uploaded Excel (.xlsx) or CSV file for Medicine Catalog Import
   */
  async parseMedicineFile(file) {
    if (typeof XLSX === 'undefined') {
      throw new Error('ไม่พบไลบรารี XLSX');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (rawRows.length < 2) {
            throw new Error('ไฟล์ไม่มีข้อมูลหรือมีเฉพาะหัวตาราง');
          }

          // Detect Header row
          let headerRowIndex = 0;
          let colMap = {
            drug_code: -1,
            drug_name: -1,
            generic_name: -1,
            dosage_form: -1,
            unit_cost: -1
          };

          for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
            const row = rawRows[i].map(c => String(c).toLowerCase().trim());
            
            row.forEach((col, idx) => {
              if (col.includes('รหัส') || col === 'code' || col === 'drug_code') colMap.drug_code = idx;
              else if (col.includes('ชื่อยา') || col.includes('รายการยา') || col === 'drug_name' || col === 'name') colMap.drug_name = idx;
              else if (col.includes('generic') || col.includes('ชื่อสามัญ')) colMap.generic_name = idx;
              else if (col.includes('dosage') || col.includes('รูปแบบ')) colMap.dosage_form = idx;
              else if (col.includes('ต้นทุน') || col.includes('ราคา') || col.includes('cost') || col.includes('price')) colMap.unit_cost = idx;
            });

            if (colMap.drug_name !== -1) {
              headerRowIndex = i;
              break;
            }
          }

          // Fallback column map if headers not clearly detected
          if (colMap.drug_name === -1) {
            colMap = { drug_code: 0, drug_name: 1, generic_name: 2, dosage_form: 3, unit_cost: 4 };
            headerRowIndex = 0;
          }

          // Get existing medicines for duplicate checking
          const existingMeds = await HospitalDB.getMedicines({ includeInactive: true });
          const existingCodes = new Set(existingMeds.map(m => m.drug_code.toLowerCase()));

          const parsedList = [];
          const seenFileCodes = new Set();

          for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.every(cell => cell === '' || cell === null)) continue; // skip blank row

            // รักษารหัสยาตามไฟล์อย่างเคร่งครัด ห้ามแปลง ห้ามตัดเลข 0 นำหน้า
            const drug_code = colMap.drug_code !== -1 && row[colMap.drug_code] !== undefined ? String(row[colMap.drug_code]).trim() : '';
            // ใช้ชื่อยาตามไฟล์ที่นำเข้าทั้งหมด
            const drug_name = colMap.drug_name !== -1 && row[colMap.drug_name] !== undefined ? String(row[colMap.drug_name]).trim() : '';
            const generic_name = colMap.generic_name !== -1 && row[colMap.generic_name] !== undefined ? String(row[colMap.generic_name]).trim() : '';
            const dosage_form = colMap.dosage_form !== -1 && row[colMap.dosage_form] !== undefined ? String(row[colMap.dosage_form]).trim() : '';
            const rawCost = colMap.unit_cost !== -1 && row[colMap.unit_cost] !== undefined ? parseFloat(row[colMap.unit_cost]) : 0;
            const unit_cost = isNaN(rawCost) || rawCost < 0 ? 0 : rawCost;

            if (!drug_name && !drug_code) continue;

            const isCodeInDb = existingCodes.has(drug_code.toLowerCase());
            const isCodeInFile = seenFileCodes.has(drug_code.toLowerCase());

            const item = {
              rowNumber: i + 1,
              drug_code: drug_code, // รหัสยาตามไฟล์ 100% ไม่เปลี่ยนรหัส
              drug_name: drug_name, // ชื่อยาตามไฟล์ 100%
              generic_name: generic_name,
              dosage_form: dosage_form,
              unit_cost: unit_cost,
              status: 'Active',
              isDuplicateInDb: isCodeInDb,
              isDuplicateInFile: isCodeInFile,
              hasError: false,
              statusType: isCodeInDb ? 'update' : 'new',
              statusMessage: isCodeInDb ? 'มีรหัสในระบบแล้ว (จะอัปเดตชื่อและข้อมูลตามไฟล์)' : 'รหัสใหม่ (จะเพิ่มเข้าระบบตามไฟล์)'
            };

            if (!drug_code) {
              item.hasError = true;
              item.statusType = 'error';
              item.statusMessage = 'ไม่มีรหัสยาในไฟล์ (ต้องระบุรหัสยาตามไฟล์)';
            } else if (!drug_name) {
              item.hasError = true;
              item.statusType = 'error';
              item.statusMessage = 'ไม่มีชื่อยาในไฟล์';
            } else if (isCodeInFile) {
              item.hasError = true;
              item.statusType = 'error';
              item.statusMessage = 'รหัสยาซ้ำกับแถวอื่นในไฟล์นี้';
            }

            if (drug_code) seenFileCodes.add(drug_code.toLowerCase());
            parsedList.push(item);
          }

          resolve(parsedList);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Download sample Excel template for medicine import
   */
  downloadTemplate() {
    const templateData = [
      ['รหัสยา', 'ชื่อยา', 'Generic name', 'Dosage form', 'ต้นทุนต่อหน่วย'],
      ['001', 'Paracetamol 500 mg', 'Paracetamol', 'Tablet', 0.50],
      ['002', 'Amoxicillin 500 mg', 'Amoxicillin', 'Capsule', 2.00],
      ['003', 'Metformin 500 mg', 'Metformin HCl', 'Tablet', 0.80],
      ['004', 'Amlodipine 5 mg', 'Amlodipine besylate', 'Tablet', 1.20],
      ['005', 'Omeprazole 20 mg', 'Omeprazole', 'Capsule', 1.50]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 25 },
      { wch: 18 },
      { wch: 18 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'ตัวอย่างไฟล์นำเข้ารายการยา_รพ_ร้องกวาง.xlsx');
  }
};

window.ExcelService = ExcelService;
