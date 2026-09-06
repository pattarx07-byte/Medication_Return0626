/**
 * Database Layer for ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย
 * ฝ่ายเภสัชกรรมและคุ้มครองผู้บริโภค โรงพยาบาลร้องกวาง
 * Created by Pattaraporn Wongjak
 * 
 * Implements Relational Architecture in Browser (IndexedDB / LocalStorage)
 * Strict Snapshot Isolation: return_items stores unit_cost at time of return!
 */

const HospitalDB = {
  dbName: 'HospitalDrugReturnDB_CleanZero_v1',
  dbVersion: 1,
  db: null,

  // Fallback in-memory storage if IndexedDB is disabled
  storageType: 'indexedDB',

  /**
   * Initialize Database and create Object Stores / Indexes (ข้อมูลเริ่มต้นเป็นศูนย์)
   */
  async init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, fallback to memory/localStorage');
        this.storageType = 'localStorage';
        this._initLocalStorage();
        resolve(this);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Medicines Store (เริ่มต้นเป็นศูนย์)
        if (!db.objectStoreNames.contains('medicines')) {
          const medStore = db.createObjectStore('medicines', { keyPath: 'id', autoIncrement: true });
          medStore.createIndex('drug_code', 'drug_code', { unique: true });
          medStore.createIndex('drug_name', 'drug_name', { unique: false });
          medStore.createIndex('status', 'status', { unique: false });
        }

        // 2. Return Transactions Store (เริ่มต้นเป็นศูนย์)
        if (!db.objectStoreNames.contains('return_transactions')) {
          const txStore = db.createObjectStore('return_transactions', { keyPath: 'id', autoIncrement: true });
          txStore.createIndex('return_date', 'return_date', { unique: false });
          txStore.createIndex('source', 'source', { unique: false });
        }

        // 3. Return Items Store (เริ่มต้นเป็นศูนย์)
        if (!db.objectStoreNames.contains('return_items')) {
          const itemStore = db.createObjectStore('return_items', { keyPath: 'id', autoIncrement: true });
          itemStore.createIndex('transaction_id', 'transaction_id', { unique: false });
          itemStore.createIndex('medicine_id', 'medicine_id', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        // ข้อมูลเบื้องต้นเป็นศูนย์ตามความต้องการ (ไม่นำข้อมูลตัวอย่างเข้ามา)
        resolve(this);
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event.target.error);
        this.storageType = 'localStorage';
        this._initLocalStorage();
        resolve(this);
      };
    });
  },

  /**
   * Seed standard hospital medicines
   */
  async seedInitialMedicines() {
    const initialList = [
      { drug_code: '001', drug_name: 'Paracetamol 500 mg', generic_name: 'Paracetamol', dosage_form: 'Tablet', unit_cost: 0.50, status: 'Active' },
      { drug_code: '002', drug_name: 'Amoxicillin 500 mg', generic_name: 'Amoxicillin', dosage_form: 'Capsule', unit_cost: 2.00, status: 'Active' },
      { drug_code: '003', drug_name: 'Metformin 500 mg', generic_name: 'Metformin HCl', dosage_form: 'Tablet', unit_cost: 0.80, status: 'Active' },
      { drug_code: '004', drug_name: 'Amlodipine 5 mg', generic_name: 'Amlodipine besylate', dosage_form: 'Tablet', unit_cost: 1.20, status: 'Active' },
      { drug_code: '005', drug_name: 'Losartan 50 mg', generic_name: 'Losartan potassium', dosage_form: 'Tablet', unit_cost: 3.50, status: 'Active' },
      { drug_code: '006', drug_name: 'Omeprazole 20 mg', generic_name: 'Omeprazole', dosage_form: 'Capsule', unit_cost: 1.50, status: 'Active' },
      { drug_code: '007', drug_name: 'Atorvastatin 20 mg', generic_name: 'Atorvastatin calcium', dosage_form: 'Tablet', unit_cost: 4.80, status: 'Active' },
      { drug_code: '008', drug_name: 'CPM 4 mg', generic_name: 'Chlorpheniramine maleate', dosage_form: 'Tablet', unit_cost: 0.25, status: 'Active' },
      { drug_code: '009', drug_name: 'Salbutamol Inhaler 100 mcg', generic_name: 'Salbutamol', dosage_form: 'MDI (Inhaler)', unit_cost: 120.00, status: 'Active' },
      { drug_code: '010', drug_name: 'Ciprofloxacin 500 mg', generic_name: 'Ciprofloxacin', dosage_form: 'Tablet', unit_cost: 5.50, status: 'Active' },
      { drug_code: '011', drug_name: 'Diclofenac 25 mg', generic_name: 'Diclofenac sodium', dosage_form: 'Tablet', unit_cost: 0.90, status: 'Active' },
      { drug_code: '012', drug_name: 'Enalapril 5 mg', generic_name: 'Enalapril maleate', dosage_form: 'Tablet', unit_cost: 1.10, status: 'Active' },
      { drug_code: '013', drug_name: 'Simvastatin 20 mg', generic_name: 'Simvastatin', dosage_form: 'Tablet', unit_cost: 1.75, status: 'Active' },
      { drug_code: '014', drug_name: 'Seretide Evohaler 25/125 mcg', generic_name: 'Fluticasone / Salmeterol', dosage_form: 'MDI (Inhaler)', unit_cost: 450.00, status: 'Active' },
      { drug_code: '015', drug_name: 'Insulin Glargine 100 IU/ml', generic_name: 'Insulin glargine', dosage_form: 'Pen Injector', unit_cost: 380.00, status: 'Active' }
    ];

    for (const med of initialList) {
      await this.addMedicine(med);
    }
  },

  /**
   * Seed authentic sample drug return transactions
   */
  async seedInitialReturns() {
    const meds = await this.getMedicines({ includeInactive: true });
    const medMap = {};
    meds.forEach(m => { medMap[m.drug_code] = m; });

    const sampleTx = [
      {
        return_date: '2026-09-01',
        source: 'OPD',
        items: [
          { drug_code: '001', quantity: 100 }, // Paracetamol: 100 * 0.50 = 50.00
          { drug_code: '002', quantity: 20 }   // Amoxicillin: 20 * 2.00 = 40.00
        ]
      },
      {
        return_date: '2026-09-02',
        source: 'IPD',
        items: [
          { drug_code: '001', quantity: 50 },  // Paracetamol: 50 * 0.50 = 25.00
          { drug_code: '009', quantity: 3 },   // Salbutamol: 3 * 120.00 = 360.00
          { drug_code: '014', quantity: 2 }    // Seretide: 2 * 450.00 = 900.00
        ]
      },
      {
        return_date: '2026-09-05',
        source: 'กล่องยาคืนทั่วไป',
        items: [
          { drug_code: '001', quantity: 100 }, // Paracetamol: 100 * 0.50 = 50.00
          { drug_code: '002', quantity: 20 },  // Amoxicillin: 20 * 2.00 = 40.00
          { drug_code: '015', quantity: 4 }    // Insulin Glargine: 4 * 380.00 = 1,520.00
        ]
      },
      {
        return_date: '2026-08-15',
        source: 'OPD',
        items: [
          { drug_code: '004', quantity: 80 },  // Amlodipine: 80 * 1.20 = 96.00
          { drug_code: '005', quantity: 60 },  // Losartan: 60 * 3.50 = 210.00
          { drug_code: '007', quantity: 50 }   // Atorvastatin: 50 * 4.80 = 240.00
        ]
      },
      {
        return_date: '2026-07-20',
        source: 'IPD',
        items: [
          { drug_code: '014', quantity: 5 },   // Seretide: 5 * 450.00 = 2,250.00
          { drug_code: '010', quantity: 40 }   // Ciprofloxacin: 40 * 5.50 = 220.00
        ]
      },
      {
        return_date: '2026-06-10',
        source: 'กล่องยาคืนทั่วไป',
        items: [
          { drug_code: '003', quantity: 150 }, // Metformin: 150 * 0.80 = 120.00
          { drug_code: '006', quantity: 90 }   // Omeprazole: 90 * 1.50 = 135.00
        ]
      }
    ];

    for (const tx of sampleTx) {
      const formattedItems = tx.items.map(item => {
        const med = medMap[item.drug_code];
        return {
          medicine_id: med.id,
          drug_code: med.drug_code,
          drug_name: med.drug_name,
          generic_name: med.generic_name,
          dosage_form: med.dosage_form,
          quantity: item.quantity,
          unit_cost: med.unit_cost
        };
      });

      await this.saveReturnTransaction({
        return_date: tx.return_date,
        source: tx.source,
        items: formattedItems
      });
    }
  },

  // ==========================================
  // MEDICINES OPERATIONS
  // ==========================================

  async getMedicines({ includeInactive = false, search = '' } = {}) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('medicines', 'readonly');
      const store = tx.objectStore('medicines');
      const request = store.getAll();

      request.onsuccess = () => {
        let list = request.result || [];
        if (!includeInactive) {
          list = list.filter(m => m.status === 'Active');
        }
        if (search) {
          const s = search.toLowerCase().trim();
          list = list.filter(m => 
            (m.drug_code && m.drug_code.toLowerCase().includes(s)) ||
            (m.drug_name && m.drug_name.toLowerCase().includes(s)) ||
            (m.generic_name && m.generic_name.toLowerCase().includes(s))
          );
        }
        // Sort by drug_code
        list.sort((a, b) => a.drug_code.localeCompare(b.drug_code, undefined, { numeric: true }));
        resolve(list);
      };

      request.onerror = () => resolve([]);
    });
  },

  async getMedicineById(id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('medicines', 'readonly');
      const store = tx.objectStore('medicines');
      const request = store.get(Number(id));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  },

  async getMedicineByCode(drugCode) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('medicines', 'readonly');
      const store = tx.objectStore('medicines');
      const index = store.index('drug_code');
      const request = index.get(String(drugCode).trim());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  },

  async addMedicine(medData) {
    const existing = await this.getMedicineByCode(medData.drug_code);
    if (existing) {
      throw new Error(`รหัสยา "${medData.drug_code}" มีอยู่ในระบบแล้ว (${existing.drug_name})`);
    }

    const newMed = {
      drug_code: String(medData.drug_code).trim(),
      drug_name: String(medData.drug_name).trim(),
      generic_name: String(medData.generic_name || '').trim(),
      dosage_form: String(medData.dosage_form || '').trim(),
      unit_cost: parseFloat(medData.unit_cost) || 0,
      status: medData.status || 'Active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('medicines', 'readwrite');
      const store = tx.objectStore('medicines');
      const request = store.add(newMed);
      request.onsuccess = (e) => resolve({ id: e.target.result, ...newMed });
      request.onerror = (e) => reject(new Error('ไม่สามารถเพิ่มข้อมูลยาได้: ' + e.target.error));
    });
  },

  async updateMedicine(id, medData) {
    const current = await this.getMedicineById(id);
    if (!current) throw new Error('ไม่พบข้อมูลยาที่ต้องการแก้ไข');

    // If code is being changed, check duplication
    if (medData.drug_code && medData.drug_code.trim() !== current.drug_code) {
      const duplicate = await this.getMedicineByCode(medData.drug_code);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`รหัสยา "${medData.drug_code}" ซ้ำกับรายการอื่นในระบบ`);
      }
    }

    const updated = {
      ...current,
      drug_code: medData.drug_code ? String(medData.drug_code).trim() : current.drug_code,
      drug_name: medData.drug_name ? String(medData.drug_name).trim() : current.drug_name,
      generic_name: medData.generic_name !== undefined ? String(medData.generic_name).trim() : current.generic_name,
      dosage_form: medData.dosage_form !== undefined ? String(medData.dosage_form).trim() : current.dosage_form,
      unit_cost: medData.unit_cost !== undefined ? parseFloat(medData.unit_cost) : current.unit_cost,
      status: medData.status !== undefined ? medData.status : current.status,
      updated_at: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('medicines', 'readwrite');
      const store = tx.objectStore('medicines');
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = (e) => reject(new Error('ไม่สามารถอัปเดตข้อมูลยาได้: ' + e.target.error));
    });
  },

  async toggleMedicineStatus(id) {
    const med = await this.getMedicineById(id);
    if (!med) throw new Error('ไม่พบข้อมูลยา');
    const newStatus = med.status === 'Active' ? 'Inactive' : 'Active';
    return await this.updateMedicine(id, { status: newStatus });
  },

  /**
   * Upsert medicine strictly using exact drug_code and drug_name from file
   */
  async upsertMedicine(medData) {
    const code = String(medData.drug_code).trim();
    if (!code) throw new Error('ไม่พบรหัสยา');
    const existing = await this.getMedicineByCode(code);
    if (existing) {
      return await this.updateMedicine(existing.id, {
        drug_code: code, // ห้ามเปลี่ยนรหัสยาเด็ดขาด
        drug_name: String(medData.drug_name).trim(), // ใช้ชื่อตามไฟล์
        generic_name: String(medData.generic_name || '').trim(),
        dosage_form: String(medData.dosage_form || '').trim(),
        unit_cost: parseFloat(medData.unit_cost) || 0,
        status: 'Active'
      });
    } else {
      return await this.addMedicine({
        drug_code: code, // ใช้รหัสยาตามไฟล์ตรงๆ
        drug_name: String(medData.drug_name).trim(), // ใช้ชื่อตามไฟล์ตรงๆ
        generic_name: String(medData.generic_name || '').trim(),
        dosage_form: String(medData.dosage_form || '').trim(),
        unit_cost: parseFloat(medData.unit_cost) || 0,
        status: 'Active'
      });
    }
  },

  /**
   * Replace all medicines in catalog with imported list (Strictly keeping exact codes and names from file)
   */
  async replaceMedicinesCatalog(medList) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('medicines', 'readwrite');
      const store = tx.objectStore('medicines');
      store.clear();

      tx.oncomplete = async () => {
        let inserted = 0;
        for (const item of medList) {
          try {
            await this.addMedicine({
              drug_code: String(item.drug_code).trim(),
              drug_name: String(item.drug_name).trim(),
              generic_name: String(item.generic_name || '').trim(),
              dosage_form: String(item.dosage_form || '').trim(),
              unit_cost: parseFloat(item.unit_cost) || 0,
              status: 'Active'
            });
            inserted++;
          } catch (e) {
            console.warn('Skipped item in replace:', item, e);
          }
        }
        resolve(inserted);
      };

      tx.onerror = (e) => reject(new Error('ไม่สามารถล้างและแทนที่รายการยาได้: ' + e.target.error));
    });
  },

  // ==========================================
  // RETURN TRANSACTIONS & ITEMS (ATOMIC SAVE)
  // ==========================================

  /**
   * Save Return Transaction with all Return Items in a single transaction
   * STORES unit_cost SNAPSHOT in return_items!
   */
  async saveReturnTransaction({ return_date, source, items, note = '' }) {
    if (!return_date) throw new Error('กรุณาระบุวันที่รับยาคืน');
    if (!['OPD', 'IPD', 'กล่องยาคืนทั่วไป'].includes(source)) {
      throw new Error('แหล่งที่มาต้องเป็น OPD, IPD หรือ กล่องยาคืนทั่วไป เท่านั้น');
    }
    if (!items || items.length === 0) {
      throw new Error('ต้องมีรายการยาอย่างน้อย 1 รายการ');
    }

    // Validate items & calculate total
    let grandTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`จำนวนยาสำหรับ "${item.drug_name || 'รายการยา'}" ต้องมากกว่า 0`);
      }

      // Ensure unit_cost is preserved from item or fetched from medicine
      const unitCost = parseFloat(item.unit_cost);
      if (isNaN(unitCost) || unitCost < 0) {
        throw new Error(`ต้นทุนต่อหน่วยสำหรับ "${item.drug_name || 'รายการยา'}" ไม่ถูกต้อง`);
      }

      const rowTotal = Math.round((qty * unitCost) * 100) / 100;
      grandTotal += rowTotal;

      validatedItems.push({
        medicine_id: Number(item.medicine_id),
        drug_code: item.drug_code,
        drug_name: item.drug_name,
        generic_name: item.generic_name || '',
        dosage_form: item.dosage_form || '',
        quantity: qty,
        unit_cost: unitCost, // Snapshot cost
        total_value: rowTotal,
        created_at: new Date().toISOString()
      });
    }

    grandTotal = Math.round(grandTotal * 100) / 100;

    return new Promise((resolve, reject) => {
      // Begin atomic transaction on both stores
      const tx = this.db.transaction(['return_transactions', 'return_items'], 'readwrite');
      const txStore = tx.objectStore('return_transactions');
      const itemStore = tx.objectStore('return_items');

      const masterRecord = {
        return_date,
        source,
        total_value: grandTotal,
        item_count: validatedItems.length,
        note: note || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const addTxRequest = txStore.add(masterRecord);

      addTxRequest.onsuccess = (e) => {
        const transactionId = e.target.result;
        masterRecord.id = transactionId;

        // Insert all return items with transaction_id
        for (const item of validatedItems) {
          item.transaction_id = transactionId;
          itemStore.add(item);
        }
      };

      tx.oncomplete = () => {
        resolve({
          ...masterRecord,
          items: validatedItems
        });
      };

      tx.onerror = (e) => {
        reject(new Error('เกิดข้อผิดพลาดในการบันทึกข้อมูล (Rollback อัตโนมัติ): ' + e.target.error));
      };
    });
  },

  /**
   * Get Return Transactions with filters
   */
  async getReturnTransactions({ startDate, endDate, source, search } = {}) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('return_transactions', 'readonly');
      const store = tx.objectStore('return_transactions');
      const request = store.getAll();

      request.onsuccess = () => {
        let list = request.result || [];

        if (startDate) {
          list = list.filter(t => t.return_date >= startDate);
        }
        if (endDate) {
          list = list.filter(t => t.return_date <= endDate);
        }
        if (source && source !== 'ทั้งหมด') {
          list = list.filter(t => t.source === source);
        }

        // Sort descending by return_date then id
        list.sort((a, b) => {
          if (b.return_date !== a.return_date) {
            return b.return_date.localeCompare(a.return_date);
          }
          return b.id - a.id;
        });

        resolve(list);
      };

      request.onerror = () => resolve([]);
    });
  },

  /**
   * Get all items for a specific transaction
   */
  async getTransactionItems(transactionId) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('return_items', 'readonly');
      const store = tx.objectStore('return_items');
      const index = store.index('transaction_id');
      const request = index.getAll(Number(transactionId));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  },

  /**
   * Get full transaction details including items
   */
  async getTransactionDetails(transactionId) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('return_transactions', 'readonly');
      const store = tx.objectStore('return_transactions');
      const request = store.get(Number(transactionId));

      request.onsuccess = async () => {
        const txData = request.result;
        if (!txData) {
          resolve(null);
          return;
        }
        const items = await this.getTransactionItems(transactionId);
        resolve({ ...txData, items });
      };

      request.onerror = () => resolve(null);
    });
  },

  /**
   * Delete transaction and its associated items
   */
  async deleteTransaction(transactionId) {
    const id = Number(transactionId);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['return_transactions', 'return_items'], 'readwrite');
      const txStore = tx.objectStore('return_transactions');
      const itemStore = tx.objectStore('return_items');
      const index = itemStore.index('transaction_id');

      // Delete items
      const itemsReq = index.getAllKeys(id);
      itemsReq.onsuccess = () => {
        const itemKeys = itemsReq.result || [];
        itemKeys.forEach(k => itemStore.delete(k));
        txStore.delete(id);
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(new Error('ไม่สามารถลบรายการได้: ' + e.target.error));
    });
  },

  /**
   * Get all return items joined with transaction info (for reports & Excel export)
   */
  async getAllReturnItemsJoined({ startDate, endDate, source, search, sortBy = 'date', sortOrder = 'desc' } = {}) {
    const transactions = await this.getReturnTransactions({ startDate, endDate, source });
    const txMap = {};
    transactions.forEach(t => { txMap[t.id] = t; });

    return new Promise((resolve) => {
      const tx = this.db.transaction('return_items', 'readonly');
      const store = tx.objectStore('return_items');
      const request = store.getAll();

      request.onsuccess = () => {
        let items = request.result || [];

        // Join with parent transaction
        items = items.map(item => {
          const parentTx = txMap[item.transaction_id];
          if (!parentTx) return null;
          return {
            ...item,
            return_date: parentTx.return_date,
            source: parentTx.source
          };
        }).filter(item => item !== null);

        // Search filter
        if (search) {
          const s = search.toLowerCase().trim();
          items = items.filter(item => 
            (item.drug_code && item.drug_code.toLowerCase().includes(s)) ||
            (item.drug_name && item.drug_name.toLowerCase().includes(s)) ||
            (item.generic_name && item.generic_name.toLowerCase().includes(s)) ||
            (item.source && item.source.toLowerCase().includes(s)) ||
            (item.return_date && item.return_date.includes(s))
          );
        }

        // Sorting
        items.sort((a, b) => {
          let comparison = 0;
          if (sortBy === 'date') {
            comparison = a.return_date.localeCompare(b.return_date);
          } else if (sortBy === 'quantity') {
            comparison = a.quantity - b.quantity;
          } else if (sortBy === 'value') {
            comparison = a.total_value - b.total_value;
          } else if (sortBy === 'drug_name') {
            comparison = a.drug_name.localeCompare(b.drug_name);
          }
          return sortOrder === 'desc' ? -comparison : comparison;
        });

        resolve(items);
      };

      request.onerror = () => resolve([]);
    });
  },

  // ==========================================
  // DASHBOARD & ANALYTICS CALCULATIONS
  // ==========================================

  /**
   * Get Dashboard KPI Totals
   */
  async getDashboardKPIs({ startDate, endDate, source } = {}) {
    const items = await this.getAllReturnItemsJoined({ startDate, endDate, source });
    const transactions = await this.getReturnTransactions({ startDate, endDate, source });

    let totalValue = 0;
    let totalUnits = 0;
    const medicineSet = new Set();

    items.forEach(item => {
      totalValue += item.total_value;
      totalUnits += item.quantity;
      medicineSet.add(item.medicine_id);
    });

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalUnits,
      distinctMedicines: medicineSet.size,
      totalTransactions: transactions.length
    };
  },

  /**
   * Top 10 Medicines with highest returned value
   */
  async getTop10Medicines({ startDate, endDate, source } = {}) {
    const items = await this.getAllReturnItemsJoined({ startDate, endDate, source });
    const medAgg = {};

    items.forEach(item => {
      const key = item.drug_code || item.drug_name;
      if (!medAgg[key]) {
        medAgg[key] = {
          drug_code: item.drug_code,
          drug_name: item.drug_name,
          generic_name: item.generic_name,
          total_quantity: 0,
          total_value: 0
        };
      }
      medAgg[key].total_quantity += item.quantity;
      medAgg[key].total_value += item.total_value;
    });

    const list = Object.values(medAgg);
    list.sort((a, b) => b.total_value - a.total_value);
    return list.slice(0, 10);
  },

  /**
   * Monthly trend breakdown for a given year
   */
  async getMonthlyTrend(yearCE, { source } = {}) {
    const yearStr = String(yearCE);
    const startDate = `${yearStr}-01-01`;
    const endDate = `${yearStr}-12-31`;
    const items = await this.getAllReturnItemsJoined({ startDate, endDate, source });

    const monthlyValues = new Array(12).fill(0);
    const monthlyUnits = new Array(12).fill(0);

    items.forEach(item => {
      const monthIdx = parseInt(item.return_date.substring(5, 7), 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        monthlyValues[monthIdx] += item.total_value;
        monthlyUnits[monthIdx] += item.quantity;
      }
    });

    return {
      months: ThaiDate.monthsShort,
      values: monthlyValues.map(v => Math.round(v * 100) / 100),
      units: monthlyUnits
    };
  },

  /**
   * Source Comparison Breakdown (OPD vs IPD vs กล่องยาคืนทั่วไป)
   */
  async getSourceDistribution({ startDate, endDate } = {}) {
    const items = await this.getAllReturnItemsJoined({ startDate, endDate });
    const sources = {
      'OPD': { units: 0, value: 0, count: 0 },
      'IPD': { units: 0, value: 0, count: 0 },
      'กล่องยาคืนทั่วไป': { units: 0, value: 0, count: 0 }
    };

    items.forEach(item => {
      if (sources[item.source]) {
        sources[item.source].units += item.quantity;
        sources[item.source].value += item.total_value;
        sources[item.source].count += 1;
      }
    });

    return {
      labels: ['OPD', 'IPD', 'กล่องยาคืนทั่วไป'],
      units: [sources['OPD'].units, sources['IPD'].units, sources['กล่องยาคืนทั่วไป'].units],
      values: [
        Math.round(sources['OPD'].value * 100) / 100,
        Math.round(sources['IPD'].value * 100) / 100,
        Math.round(sources['กล่องยาคืนทั่วไป'].value * 100) / 100
      ]
    };
  },

  /**
   * Reset database to ZERO (ล้างข้อมูลทั้งหมดให้เป็นศูนย์)
   */
  async resetDatabase() {
    return new Promise((resolve) => {
      const tx = this.db.transaction(['medicines', 'return_transactions', 'return_items'], 'readwrite');
      tx.objectStore('medicines').clear();
      tx.objectStore('return_transactions').clear();
      tx.objectStore('return_items').clear();

      tx.oncomplete = () => {
        resolve(true);
      };
    });
  }
};

window.HospitalDB = HospitalDB;
