/**
 * Main Application Logic & SPA Routing
 * ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย โรงพยาบาลร้องกวาง
 * Created by Pattaraporn Wongjak
 */

const App = {
  currentView: 'dashboard',
  medicinesList: [],
  activeMedicines: [],
  
  // Return Form State
  returnFormItems: [],

  // Report State
  reportFilter: {
    mode: 'daily', // 'daily' | 'weekly' | 'monthly' | 'yearly'
    date: ThaiDate.todayISO(),
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    source: 'ทั้งหมด',
    search: '',
    sortBy: 'date',
    sortOrder: 'desc'
  },

  // Dashboard Filter State
  dashboardFilter: {
    startDate: '',
    endDate: '',
    source: 'ทั้งหมด',
    preset: 'month'
  },

  /**
   * App Initialization
   */
  async init() {
    try {
      await HospitalDB.init();
      await this.reloadMedicines();
      this.initDatePickers();
      this.setupEventListeners();
      this.setDashboardPreset('month'); // default to this month
      this.renderCurrentView();
      console.log('ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย รพ.ร้องกวาง พร้อมใช้งาน');
    } catch (err) {
      console.error('App init error:', err);
      alert('เกิดข้อผิดพลาดในการเริ่มต้นระบบ: ' + err.message);
    }
  },

  async reloadMedicines() {
    this.medicinesList = await HospitalDB.getMedicines({ includeInactive: true });
    this.activeMedicines = this.medicinesList.filter(m => m.status === 'Active');
  },

  /**
   * View Router
   */
  navigate(viewName) {
    this.currentView = viewName;
    
    // Update active nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.dataset.view === viewName) {
        el.classList.add('nav-item-active');
      } else {
        el.classList.remove('nav-item-active');
      }
    });

    // Hide all view sections, show target
    document.querySelectorAll('.view-section').forEach(el => {
      el.classList.add('hidden');
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('fade-in');
    }

    this.renderCurrentView();
  },

  renderCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'return-form':
        this.renderReturnForm();
        break;
      case 'reports':
        this.renderReports();
        break;
      case 'medicines':
        this.renderMedicinesManagement();
        break;
      case 'import':
        this.renderImportPage();
        break;
      case 'export':
        this.renderExportPage();
        break;
      case 'tests':
        this.renderTestsPage();
        break;
    }
  },

  // ==========================================
  // DASHBOARD VIEW
  // ==========================================

  setDashboardPreset(preset) {
    this.dashboardFilter.preset = preset;
    const today = new Date();
    const todayStr = ThaiDate.todayISO();

    if (preset === 'today') {
      this.dashboardFilter.startDate = todayStr;
      this.dashboardFilter.endDate = todayStr;
    } else if (preset === '7days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      this.dashboardFilter.startDate = d.toISOString().split('T')[0];
      this.dashboardFilter.endDate = todayStr;
    } else if (preset === 'month') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      this.dashboardFilter.startDate = `${y}-${m}-01`;
      this.dashboardFilter.endDate = todayStr;
    } else if (preset === 'year') {
      const y = today.getFullYear();
      this.dashboardFilter.startDate = `${y}-01-01`;
      this.dashboardFilter.endDate = `${y}-12-31`;
    } else if (preset === 'all') {
      this.dashboardFilter.startDate = '';
      this.dashboardFilter.endDate = '';
    }

    // Update preset button styles
    document.querySelectorAll('.btn-preset').forEach(btn => {
      if (btn.dataset.preset === preset) {
        btn.classList.add('bg-teal-700', 'text-white');
        btn.classList.remove('bg-white', 'text-slate-700');
      } else {
        btn.classList.remove('bg-teal-700', 'text-white');
        btn.classList.add('bg-white', 'text-slate-700');
      }
    });

    const startInput = document.getElementById('dash-start-date');
    const endInput = document.getElementById('dash-end-date');
    if (startInput) startInput.value = this.dashboardFilter.startDate;
    if (endInput) endInput.value = this.dashboardFilter.endDate;

    if (this.currentView === 'dashboard') {
      this.renderDashboard();
    }
  },

  async renderDashboard() {
    const filters = {
      startDate: this.dashboardFilter.startDate,
      endDate: this.dashboardFilter.endDate,
      source: this.dashboardFilter.source
    };

    // 1. KPI Cards
    const kpi = await HospitalDB.getDashboardKPIs(filters);
    document.getElementById('kpi-total-value').textContent = ThaiDate.formatTHB(kpi.totalValue);
    document.getElementById('kpi-total-units').textContent = ThaiDate.formatNumber(kpi.totalUnits) + ' หน่วย';
    document.getElementById('kpi-distinct-meds').textContent = ThaiDate.formatNumber(kpi.distinctMedicines) + ' รายการ';
    document.getElementById('kpi-total-tx').textContent = ThaiDate.formatNumber(kpi.totalTransactions) + ' ครั้ง';

    // 2. Top 10 Horizontal Bar Chart
    const top10 = await HospitalDB.getTop10Medicines(filters);
    HospitalCharts.renderTop10('chart-top10', top10);

    // Render Top 10 Quick Table
    const topTableBody = document.getElementById('dash-top10-table-body');
    if (topTableBody) {
      if (top10.length === 0) {
        topTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-400 py-4">ไม่มีข้อมูลยาคืนในช่วงที่เลือก</td></tr>';
      } else {
        topTableBody.innerHTML = top10.map((item, idx) => `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-3 py-2 text-center font-bold ${idx < 3 ? 'text-teal-600' : 'text-slate-500'}">อันดับ ${idx + 1}</td>
            <td class="px-3 py-2 font-medium text-slate-800">${item.drug_name}</td>
            <td class="px-3 py-2 text-right number-cell">${ThaiDate.formatNumber(item.total_quantity)}</td>
            <td class="px-3 py-2 text-right font-semibold text-teal-700 number-cell">${ThaiDate.formatTHB(item.total_value)}</td>
          </tr>
        `).join('');
      }
    }

    // 3. Monthly Trend Chart
    const currentYear = this.dashboardFilter.startDate ? parseInt(this.dashboardFilter.startDate.substring(0, 4), 10) : new Date().getFullYear();
    const trendData = await HospitalDB.getMonthlyTrend(currentYear, { source: filters.source });
    HospitalCharts.renderMonthlyTrend('chart-monthly-trend', trendData);
    document.getElementById('trend-year-label').textContent = `ปี พ.ศ. ${currentYear + 543}`;

    // 4. Source Comparison Chart
    const sourceData = await HospitalDB.getSourceDistribution({
      startDate: filters.startDate,
      endDate: filters.endDate
    });
    HospitalCharts.renderSourceDistribution('chart-source-dist', sourceData);
  },

  // ==========================================
  // RETURN ENTRY FORM (บันทึกการรับยาคืน)
  // ==========================================

  renderReturnForm() {
    const dateInput = document.getElementById('return-date-input');
    if (dateInput && !dateInput.value) {
      dateInput.value = ThaiDate.todayISO();
      this.updateReturnDateThaiDisplay(dateInput.value);
    }

    // Default to having 1 empty row if none exists
    if (this.returnFormItems.length === 0) {
      this.addReturnItemRow();
    } else {
      this.renderReturnTableRows();
    }
  },

  updateReturnDateThaiDisplay(isoDate) {
    const label = document.getElementById('return-date-thai-label');
    if (label) {
      label.textContent = isoDate ? `(วันที่แบบไทย: ${ThaiDate.formatFull(isoDate)})` : '';
    }
  },

  addReturnItemRow(prefilled = null) {
    const newItem = prefilled || {
      rowId: Date.now() + Math.random(),
      medicineId: '',
      drugCode: '',
      drugName: '',
      genericName: '',
      dosageForm: '',
      unitCost: 0,
      quantity: 1,
      totalValue: 0
    };

    if (newItem.unitCost && newItem.quantity) {
      newItem.totalValue = Math.round((newItem.quantity * newItem.unitCost) * 100) / 100;
    }

    this.returnFormItems.push(newItem);
    this.renderReturnTableRows();
  },

  removeReturnItemRow(index) {
    if (this.returnFormItems.length <= 1) {
      // Clear row instead of deleting last row
      this.returnFormItems[0] = {
        rowId: Date.now(),
        medicineId: '',
        drugCode: '',
        drugName: '',
        genericName: '',
        dosageForm: '',
        unitCost: 0,
        quantity: 1,
        totalValue: 0
      };
    } else {
      this.returnFormItems.splice(index, 1);
    }
    this.renderReturnTableRows();
  },

  onDrugSelectedInRow(rowIndex, medicineId) {
    const med = this.activeMedicines.find(m => m.id === Number(medicineId));
    const row = this.returnFormItems[rowIndex];
    if (!row) return;

    if (med) {
      row.medicineId = med.id;
      row.drugCode = med.drug_code;
      row.drugName = med.drug_name;
      row.genericName = med.generic_name;
      row.dosageForm = med.dosage_form;
      row.unitCost = med.unit_cost;
      row.totalValue = Math.round((row.quantity * med.unit_cost) * 100) / 100;
    } else {
      row.medicineId = '';
      row.drugCode = '';
      row.drugName = '';
      row.genericName = '';
      row.dosageForm = '';
      row.unitCost = 0;
      row.totalValue = 0;
    }

    this.renderReturnTableRows();
  },

  selectDrugInRow(rowIndex, medicineId) {
    this.onDrugSelectedInRow(rowIndex, medicineId);
    // Auto focus quantity field for fast input
    setTimeout(() => {
      const qtyInput = document.getElementById(`row-qty-${rowIndex}`);
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }, 50);
  },

  clearDrugInRow(rowIndex) {
    const row = this.returnFormItems[rowIndex];
    if (row) {
      row.medicineId = '';
      row.drugCode = '';
      row.drugName = '';
      row.genericName = '';
      row.dosageForm = '';
      row.unitCost = 0;
      row.totalValue = 0;
    }
    this.renderReturnTableRows();
    setTimeout(() => {
      const input = document.getElementById(`row-med-input-${rowIndex}`);
      if (input) input.focus();
    }, 50);
  },

  // --------------------------------------------------
  // Searchable Autocomplete in each table row
  // --------------------------------------------------
  onRowMedSearchInput(rowIndex, query) {
    this.renderRowSearchDropdown(rowIndex, query);
  },

  onRowMedSearchFocus(rowIndex, query) {
    this.renderRowSearchDropdown(rowIndex, query);
  },

  renderRowSearchDropdown(rowIndex, query) {
    const dropdown = document.getElementById(`row-med-dropdown-${rowIndex}`);
    if (!dropdown) return;

    const s = (query || '').toLowerCase().trim();
    let matches = this.activeMedicines;
    if (s) {
      matches = this.activeMedicines.filter(m =>
        (m.drug_code && m.drug_code.toLowerCase().includes(s)) ||
        (m.drug_name && m.drug_name.toLowerCase().includes(s)) ||
        (m.generic_name && m.generic_name.toLowerCase().includes(s))
      );
    }

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">ไม่พบรายการยาที่ค้นหา "${query}"</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = matches.slice(0, 30).map(m => `
      <div class="search-dropdown-item" onclick="App.selectDrugInRow(${rowIndex}, ${m.id})">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-900 text-xs">
            <span class="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded mr-1.5">[${m.drug_code}]</span>
            ${m.drug_name}
          </span>
          <span class="font-bold text-teal-800 text-xs bg-slate-100 px-2 py-0.5 rounded number-cell">
            ${m.unit_cost.toFixed(2)} บ.
          </span>
        </div>
        <div class="text-[11px] text-slate-500 mt-0.5 flex gap-2">
          <span>Generic: <span class="font-medium text-slate-700">${m.generic_name || '-'}</span></span>
          <span>•</span>
          <span>รูปแบบ: <span class="font-medium text-slate-700">${m.dosage_form || '-'}</span></span>
        </div>
      </div>
    `).join('');

    dropdown.classList.remove('hidden');
  },

  // --------------------------------------------------
  // Quick Search & Add Bar at top of Table
  // --------------------------------------------------
  onQuickSearchInput(query) {
    this.renderQuickSearchDropdown(query);
  },

  onQuickSearchFocus(query) {
    this.renderQuickSearchDropdown(query);
  },

  renderQuickSearchDropdown(query) {
    const dropdown = document.getElementById('quick-search-dropdown');
    if (!dropdown) return;

    const s = (query || '').toLowerCase().trim();
    let matches = this.activeMedicines;
    if (s) {
      matches = this.activeMedicines.filter(m =>
        (m.drug_code && m.drug_code.toLowerCase().includes(s)) ||
        (m.drug_name && m.drug_name.toLowerCase().includes(s)) ||
        (m.generic_name && m.generic_name.toLowerCase().includes(s))
      );
    }

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="p-4 text-xs text-slate-400 text-center">ไม่พบรายการยาที่ค้นหา "${query}"</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = matches.slice(0, 30).map(m => `
      <div class="search-dropdown-item" onclick="App.selectQuickSearchDrug(${m.id})">
        <div class="flex items-center justify-between">
          <span class="font-bold text-slate-900 text-sm">
            <span class="font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded mr-2 font-bold">[${m.drug_code}]</span>
            ${m.drug_name}
          </span>
          <span class="font-bold text-teal-800 text-sm bg-slate-100 px-2.5 py-0.5 rounded number-cell">
            ต้นทุน ${m.unit_cost.toFixed(2)} บาท/หน่วย
          </span>
        </div>
        <div class="text-xs text-slate-500 mt-1 flex gap-3">
          <span>Generic name: <strong class="text-slate-700">${m.generic_name || '-'}</strong></span>
          <span>•</span>
          <span>รูปแบบยา: <strong class="text-slate-700">${m.dosage_form || '-'}</strong></span>
        </div>
      </div>
    `).join('');

    dropdown.classList.remove('hidden');
  },

  selectQuickSearchDrug(medicineId) {
    const med = this.activeMedicines.find(m => m.id === Number(medicineId));
    if (!med) return;

    // Find if an empty row exists
    let targetIndex = this.returnFormItems.findIndex(i => !i.medicineId);
    if (targetIndex === -1) {
      // Add new row prefilled
      this.addReturnItemRow({
        rowId: Date.now() + Math.random(),
        medicineId: med.id,
        drugCode: med.drug_code,
        drugName: med.drug_name,
        genericName: med.generic_name,
        dosageForm: med.dosage_form,
        unitCost: med.unit_cost,
        quantity: 1,
        totalValue: med.unit_cost
      });
      targetIndex = this.returnFormItems.length - 1;
    } else {
      this.onDrugSelectedInRow(targetIndex, med.id);
    }

    // Reset quick search input and hide dropdown
    const quickInput = document.getElementById('return-quick-search');
    if (quickInput) quickInput.value = '';
    const dropdown = document.getElementById('quick-search-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    // Auto focus on quantity
    setTimeout(() => {
      const qtyInput = document.getElementById(`row-qty-${targetIndex}`);
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }, 50);
  },

  onQuantityChanged(rowIndex, newQty) {
    const row = this.returnFormItems[rowIndex];
    if (!row) return;

    const qty = parseInt(newQty, 10);
    row.quantity = isNaN(qty) || qty < 0 ? 0 : qty;
    row.totalValue = Math.round((row.quantity * row.unitCost) * 100) / 100;

    // Fast update row total and grand total without re-rendering entire table
    const rowTotalEl = document.getElementById(`row-total-${rowIndex}`);
    if (rowTotalEl) {
      rowTotalEl.textContent = ThaiDate.formatTHB(row.totalValue);
    }
    this.updateGrandTotalDisplay();
  },

  updateGrandTotalDisplay() {
    let grandTotal = 0;
    let totalQty = 0;
    this.returnFormItems.forEach(item => {
      if (item.medicineId && item.quantity > 0) {
        grandTotal += item.totalValue;
        totalQty += item.quantity;
      }
    });

    grandTotal = Math.round(grandTotal * 100) / 100;
    const grandTotalEl = document.getElementById('return-grand-total');
    const grandQtyEl = document.getElementById('return-grand-qty');
    const grandItemCountEl = document.getElementById('return-grand-count');

    if (grandTotalEl) grandTotalEl.textContent = ThaiDate.formatTHB(grandTotal);
    if (grandQtyEl) grandQtyEl.textContent = ThaiDate.formatNumber(totalQty) + ' หน่วย';
    if (grandItemCountEl) grandItemCountEl.textContent = this.returnFormItems.filter(i => i.medicineId).length + ' รายการ';
  },

  renderReturnTableRows() {
    const tbody = document.getElementById('return-items-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.returnFormItems.map((item, idx) => {
      // Preview Badge to prevent wrong drug selection
      const previewBadge = item.medicineId ? `
        <div class="mt-1.5 p-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-bold text-teal-800"><i class="inline-block w-2 h-2 rounded-full bg-teal-600 mr-1"></i>รหัสยา: ${item.drugCode}</span>
          <span>Generic: <span class="font-medium text-slate-700">${item.genericName || '-'}</span></span>
          <span>รูปแบบ: <span class="font-medium text-slate-700">${item.dosageForm || '-'}</span></span>
          <span class="text-teal-700 font-semibold bg-white px-2 py-0.5 rounded border border-teal-200">ต้นทุน: ${item.unitCost.toFixed(2)} บาท/หน่วย</span>
        </div>
      ` : '';

      return `
        <tr class="align-top border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
          <td class="px-3 py-3 text-center font-bold text-slate-400 text-sm">${idx + 1}</td>
          <td class="px-3 py-3">
            <div class="relative search-dropdown-container">
              ${item.medicineId ? `
                <div class="flex items-center justify-between p-2 rounded-lg border border-teal-300 bg-teal-50/40 text-sm font-semibold text-slate-900">
                  <div class="truncate">
                    <span class="font-mono text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200 mr-1.5 font-bold">[${item.drugCode}]</span>
                    <span>${item.drugName}</span>
                  </div>
                  <button type="button" onclick="App.clearDrugInRow(${idx})"
                    class="ml-2 text-xs text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 px-2 py-1 rounded border border-slate-200 shadow-sm transition-colors flex-shrink-0"
                    title="เปลี่ยนรายการยา">
                    ✕ เปลี่ยนยา
                  </button>
                </div>
              ` : `
                <div class="relative">
                  <input type="text" id="row-med-input-${idx}"
                    autocomplete="off"
                    placeholder="🔍 พิมพ์ชื่อยา, รหัสยา หรือ generic name..."
                    class="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                    oninput="App.onRowMedSearchInput(${idx}, this.value)"
                    onfocus="App.onRowMedSearchFocus(${idx}, this.value)">
                </div>
              `}
              <div id="row-med-dropdown-${idx}" class="search-dropdown-menu hidden"></div>
              ${previewBadge}
            </div>
          </td>
          <td class="px-3 py-3 w-32">
            <input type="number" min="1" step="1" id="row-qty-${idx}" value="${item.quantity}"
              class="w-full text-right text-sm border border-slate-300 rounded-lg px-3 py-2 font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none"
              oninput="App.onQuantityChanged(${idx}, this.value)"
              placeholder="จำนวน">
          </td>
          <td class="px-3 py-3 w-36 text-right number-cell">
            <div class="py-2 text-slate-600 text-sm font-medium bg-slate-50 px-2 rounded border border-slate-200">
              ${item.unitCost ? item.unitCost.toFixed(2) + ' บ.' : '-'}
            </div>
          </td>
          <td class="px-3 py-3 w-40 text-right number-cell">
            <div id="row-total-${idx}" class="py-2 font-bold text-teal-700 text-base">
              ${ThaiDate.formatTHB(item.totalValue)}
            </div>
          </td>
          <td class="px-3 py-3 w-16 text-center">
            <button type="button" onclick="App.removeReturnItemRow(${idx})"
              class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              title="ลบรายการนี้">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.updateGrandTotalDisplay();
  },

  async submitReturnForm() {
    const returnDate = document.getElementById('return-date-input').value;
    const sourceRadio = document.querySelector('input[name="return-source"]:checked');
    const source = sourceRadio ? sourceRadio.value : '';
    const note = document.getElementById('return-note-input')?.value || '';

    // Validation
    if (!returnDate) {
      alert('กรุณาระบุวันที่รับยาคืน');
      return;
    }
    if (!source || !['OPD', 'IPD', 'กล่องยาคืนทั่วไป'].includes(source)) {
      alert('กรุณาเลือกแหล่งที่มาของยาคืน (OPD, IPD หรือ กล่องยาคืนทั่วไป)');
      return;
    }

    const validItems = this.returnFormItems.filter(item => item.medicineId && item.quantity > 0);
    if (validItems.length === 0) {
      alert('กรุณาเลือกรายการยาอย่างน้อย 1 รายการ และระบุจำนวนยาให้มากกว่า 0');
      return;
    }

    // Check invalid quantities
    for (const it of validItems) {
      if (it.quantity <= 0) {
        alert(`รายการยา "${it.drugName}" ต้องมีจำนวนมากกว่า 0`);
        return;
      }
    }

    let grandTotal = validItems.reduce((sum, it) => sum + it.totalValue, 0);

    // Confirmation Modal
    const confirmMessage = `ยืนยันการบันทึกการรับยาคืน?\n\n` +
      `วันที่: ${ThaiDate.formatFull(returnDate)}\n` +
      `แหล่งที่มา: ${source}\n` +
      `จำนวนรายการ: ${validItems.length} รายการ\n` +
      `มูลค่ารวมทั้งสิ้น: ${ThaiDate.formatTHB(grandTotal)}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const payload = {
        return_date: returnDate,
        source: source,
        note: note,
        items: validItems.map(item => ({
          medicine_id: item.medicineId,
          drug_code: item.drugCode,
          drug_name: item.drugName,
          generic_name: item.genericName,
          dosage_form: item.dosageForm,
          quantity: item.quantity,
          unit_cost: item.unitCost // SNAPSHOT!
        }))
      };

      const result = await HospitalDB.saveReturnTransaction(payload);

      // Show hospital success alert
      this.showToast('บันทึกข้อมูลการรับยาคืนเรียบร้อยแล้ว');

      // Reset form
      this.returnFormItems = [];
      this.addReturnItemRow();
      if (document.getElementById('return-note-input')) {
        document.getElementById('return-note-input').value = '';
      }

      // Navigate to reports or refresh dashboard
      setTimeout(() => {
        if (confirm('บันทึกสำเร็จ! คุณต้องการดูหน้ารายงานข้อมูลหรือไม่?')) {
          this.reportFilter.date = returnDate;
          this.navigate('reports');
        }
      }, 300);

    } catch (err) {
      console.error('Save return error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    }
  },

  resetReturnForm() {
    if (confirm('ต้องการล้างข้อมูลในฟอร์มทั้งหมดใช่หรือไม่?')) {
      this.returnFormItems = [];
      this.addReturnItemRow();
      document.getElementById('return-date-input').value = ThaiDate.todayISO();
      this.updateReturnDateThaiDisplay(ThaiDate.todayISO());
      const opdRadio = document.querySelector('input[name="return-source"][value="OPD"]');
      if (opdRadio) opdRadio.checked = true;
      if (document.getElementById('return-note-input')) {
        document.getElementById('return-note-input').value = '';
      }
    }
  },

  // ==========================================
  // REPORTS VIEW (รายงานข้อมูล)
  // ==========================================

  setReportMode(mode) {
    this.reportFilter.mode = mode;
    document.querySelectorAll('.btn-report-tab').forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('bg-teal-700', 'text-white');
        btn.classList.remove('bg-white', 'text-slate-700');
      } else {
        btn.classList.remove('bg-teal-700', 'text-white');
        btn.classList.add('bg-white', 'text-slate-700');
      }
    });

    // Toggle specific filter controls (Day picker vs Month picker vs Year picker)
    const dayBox = document.getElementById('report-control-day');
    const monthBox = document.getElementById('report-control-month');
    const yearBox = document.getElementById('report-control-year');

    if (dayBox) dayBox.classList.toggle('hidden', mode !== 'daily');
    if (monthBox) monthBox.classList.toggle('hidden', mode !== 'monthly');
    if (yearBox) yearBox.classList.toggle('hidden', mode !== 'monthly' && mode !== 'yearly');

    this.renderReports();
  },

  async renderReports() {
    const { mode, date, month, year, source, search, sortBy, sortOrder } = this.reportFilter;
    let startDate = '';
    let endDate = '';
    let reportTitle = '';

    if (mode === 'daily') {
      startDate = date;
      endDate = date;
      reportTitle = `รายงานการรับยาคืนประจำวัน: ${ThaiDate.formatFull(date)}`;
    } else if (mode === 'weekly') {
      // Selected date's week (Monday to Sunday)
      const cur = new Date(date);
      const day = cur.getDay();
      const diff = cur.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      const mon = new Date(cur.setDate(diff));
      const sun = new Date(cur.setDate(diff + 6));
      startDate = mon.toISOString().split('T')[0];
      endDate = sun.toISOString().split('T')[0];
      reportTitle = `รายงานประจำสัปดาห์: ${ThaiDate.formatShort(startDate)} ถึง ${ThaiDate.formatShort(endDate)}`;
    } else if (mode === 'monthly') {
      const mStr = String(month).padStart(2, '0');
      startDate = `${year}-${mStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${mStr}-${lastDay}`;
      reportTitle = `รายงานประจำเดือน: ${ThaiDate.formatMonthYear(month, year)}`;
    } else if (mode === 'yearly') {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
      reportTitle = `รายงานสรุปประจำปี พ.ศ. ${parseInt(year, 10) + 543}`;
    }

    document.getElementById('report-title-display').textContent = reportTitle;

    // For yearly view: show 12-month summary breakdown table
    const yearlyTableContainer = document.getElementById('report-yearly-container');
    const itemsTableContainer = document.getElementById('report-items-container');

    if (mode === 'yearly') {
      if (yearlyTableContainer) yearlyTableContainer.classList.remove('hidden');
      if (itemsTableContainer) itemsTableContainer.classList.add('hidden');
      await this.renderYearlyReportTable(year, source);
    } else {
      if (yearlyTableContainer) yearlyTableContainer.classList.add('hidden');
      if (itemsTableContainer) itemsTableContainer.classList.remove('hidden');
      await this.renderItemsReportTable({ startDate, endDate, source, search, sortBy, sortOrder });
    }
  },

  async renderItemsReportTable({ startDate, endDate, source, search, sortBy, sortOrder }) {
    const items = await HospitalDB.getAllReturnItemsJoined({
      startDate,
      endDate,
      source,
      search,
      sortBy,
      sortOrder
    });

    const tbody = document.getElementById('report-items-table-body');
    const grandTotalEl = document.getElementById('report-total-value');
    const grandQtyEl = document.getElementById('report-total-units');
    const grandCountEl = document.getElementById('report-total-count');

    let sumValue = 0;
    let sumQty = 0;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 font-medium">ไม่พบข้อมูลการรับยาคืนที่ตรงกับเงื่อนไข</td></tr>`;
      grandTotalEl.textContent = '0.00 บาท';
      grandQtyEl.textContent = '0 หน่วย';
      grandCountEl.textContent = '0 รายการ';
      return;
    }

    tbody.innerHTML = items.map((item, idx) => {
      sumValue += item.total_value;
      sumQty += item.quantity;

      const sourceBadgeClass = item.source === 'OPD' ? 'badge-source-opd' :
        item.source === 'IPD' ? 'badge-source-ipd' : 'badge-source-box';

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-4 py-3 text-center text-slate-500 font-medium text-xs">${idx + 1}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800">
            ${ThaiDate.formatShort(item.return_date)}
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${sourceBadgeClass}">
              ${item.source}
            </span>
          </td>
          <td class="px-4 py-3">
            <div class="font-semibold text-slate-900">${item.drug_name}</div>
            <div class="text-xs text-slate-500">รหัส: ${item.drug_code} | ${item.generic_name || '-'} (${item.dosage_form || '-'})</div>
          </td>
          <td class="px-4 py-3 text-right number-cell font-bold text-slate-700">
            ${ThaiDate.formatNumber(item.quantity)}
          </td>
          <td class="px-4 py-3 text-right number-cell text-slate-600 text-sm">
            ${item.unit_cost.toFixed(2)} บ.
          </td>
          <td class="px-4 py-3 text-right number-cell font-bold text-teal-700 text-base">
            ${ThaiDate.formatTHB(item.total_value)}
          </td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            <button onclick="App.viewTransactionDetails(${item.transaction_id})"
              class="text-xs text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded border border-teal-200 transition-colors mr-1">
              ดูบิล
            </button>
            <button onclick="App.confirmDeleteTransaction(${item.transaction_id})"
              class="text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded border border-rose-200 transition-colors"
              title="ยกเลิกรายการนี้">
              ยกเลิก
            </button>
          </td>
        </tr>
      `;
    }).join('');

    grandTotalEl.textContent = ThaiDate.formatTHB(sumValue);
    grandQtyEl.textContent = ThaiDate.formatNumber(sumQty) + ' หน่วย';
    grandCountEl.textContent = items.length + ' รายการ';
  },

  async renderYearlyReportTable(year, source) {
    const trend = await HospitalDB.getMonthlyTrend(year, { source });
    const tbody = document.getElementById('report-yearly-table-body');
    const grandTotalEl = document.getElementById('report-yearly-total-value');
    const grandQtyEl = document.getElementById('report-yearly-total-units');

    let sumYearValue = 0;
    let sumYearQty = 0;

    tbody.innerHTML = ThaiDate.monthsFull.map((monthName, idx) => {
      const val = trend.values[idx] || 0;
      const qty = trend.units[idx] || 0;
      sumYearValue += val;
      sumYearQty += qty;

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-4 py-3 text-center text-slate-400 font-bold">${idx + 1}</td>
          <td class="px-4 py-3 font-semibold text-slate-800">${monthName}</td>
          <td class="px-4 py-3 text-right number-cell font-medium text-slate-700">
            ${ThaiDate.formatNumber(qty)} หน่วย
          </td>
          <td class="px-4 py-3 text-right number-cell font-bold text-teal-700 text-base">
            ${ThaiDate.formatTHB(val)}
          </td>
          <td class="px-4 py-3 text-center">
            <button onclick="App.drillDownMonth(${idx + 1}, ${year})"
              class="text-xs text-sky-700 hover:text-sky-900 bg-sky-50 px-2.5 py-1 rounded border border-sky-200">
              ดูข้อมูลเดือนนี้
            </button>
          </td>
        </tr>
      `;
    }).join('');

    grandTotalEl.textContent = ThaiDate.formatTHB(sumYearValue);
    grandQtyEl.textContent = ThaiDate.formatNumber(sumYearQty) + ' หน่วย';
  },

  drillDownMonth(month, year) {
    this.reportFilter.month = String(month);
    this.reportFilter.year = String(year);
    this.setReportMode('monthly');
  },

  async viewTransactionDetails(transactionId) {
    const tx = await HospitalDB.getTransactionDetails(transactionId);
    if (!tx) {
      alert('ไม่พบข้อมูลรายการ');
      return;
    }

    const modal = document.getElementById('modal-tx-details');
    document.getElementById('modal-tx-id').textContent = `#TX-${String(tx.id).padStart(5, '0')}`;
    document.getElementById('modal-tx-date').textContent = ThaiDate.formatFull(tx.return_date);
    document.getElementById('modal-tx-source').textContent = tx.source;
    document.getElementById('modal-tx-total').textContent = ThaiDate.formatTHB(tx.total_value);

    const itemsBody = document.getElementById('modal-tx-items-body');
    itemsBody.innerHTML = tx.items.map((it, idx) => `
      <tr class="border-b border-slate-100">
        <td class="px-3 py-2 text-center text-slate-400">${idx + 1}</td>
        <td class="px-3 py-2 font-medium text-slate-800">${it.drug_name} (${it.drug_code})</td>
        <td class="px-3 py-2 text-right number-cell">${ThaiDate.formatNumber(it.quantity)}</td>
        <td class="px-3 py-2 text-right number-cell">${it.unit_cost.toFixed(2)} บ.</td>
        <td class="px-3 py-2 text-right number-cell font-bold text-teal-700">${ThaiDate.formatTHB(it.total_value)}</td>
      </tr>
    `).join('');

    modal.classList.remove('hidden');
  },

  closeTxModal() {
    document.getElementById('modal-tx-details').classList.add('hidden');
  },

  async confirmDeleteTransaction(transactionId) {
    if (confirm(`คำเตือน: คุณต้องการยกเลิกและลบรายการรับยาคืน #${transactionId} ออกจากระบบใช่หรือไม่?\n(การกระทำนี้จะส่งผลต่อยอดรวมสถิติ)`)) {
      try {
        await HospitalDB.deleteTransaction(transactionId);
        this.showToast('ยกเลิกรายการเรียบร้อยแล้ว');
        this.renderReports();
      } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    }
  },

  async exportCurrentReportToExcel() {
    const { mode, date, month, year, source, search } = this.reportFilter;
    let startDate = '';
    let endDate = '';
    let title = '';

    if (mode === 'daily') {
      startDate = date;
      endDate = date;
      title = `รายงานรายวัน_${ThaiDate.formatShort(date).replace(/\//g, '-')}`;
    } else if (mode === 'monthly') {
      const mStr = String(month).padStart(2, '0');
      startDate = `${year}-${mStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${mStr}-${lastDay}`;
      title = `รายงานประจำเดือน_${month}_${parseInt(year, 10) + 543}`;
    } else if (mode === 'yearly') {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
      title = `รายงานประจำปี_${parseInt(year, 10) + 543}`;
    } else {
      title = `รายงานข้อมูลยาคืน`;
    }

    const items = await HospitalDB.getAllReturnItemsJoined({ startDate, endDate, source, search });
    if (items.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออกตามเงื่อนไขที่เลือก');
      return;
    }

    const dateRangeStr = startDate && endDate ? `${ThaiDate.formatShort(startDate)} ถึง ${ThaiDate.formatShort(endDate)}` : 'ทั้งหมด';
    ExcelService.exportReturnsToExcel(items, { title, dateRange: dateRangeStr, source });
  },

  // ==========================================
  // MEDICINES MANAGEMENT (จัดการรายการยา)
  // ==========================================

  renderMedicinesManagement() {
    const searchInput = document.getElementById('med-search-input')?.value || '';
    const statusFilter = document.getElementById('med-status-filter')?.value || 'all';

    let list = this.medicinesList;

    if (statusFilter !== 'all') {
      list = list.filter(m => m.status === statusFilter);
    }
    if (searchInput) {
      const s = searchInput.toLowerCase().trim();
      list = list.filter(m =>
        m.drug_code.toLowerCase().includes(s) ||
        m.drug_name.toLowerCase().includes(s) ||
        (m.generic_name && m.generic_name.toLowerCase().includes(s))
      );
    }

    document.getElementById('med-count-badge').textContent = `${list.length} รายการ`;

    const tbody = document.getElementById('medicines-table-body');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">ไม่พบรายการยาที่ตรงกับเงื่อนไข</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((med, idx) => {
      const isAct = med.status === 'Active';
      const statusBadge = isAct
        ? '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold badge-active">เปิดใช้งาน (Active)</span>'
        : '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold badge-inactive">ปิดใช้งาน (Inactive)</span>';

      return `
        <tr class="hover:bg-slate-50 transition-colors ${!isAct ? 'opacity-60 bg-slate-50/50' : ''}">
          <td class="px-4 py-3 font-mono font-bold text-teal-700 text-sm">${med.drug_code}</td>
          <td class="px-4 py-3 font-medium text-slate-900">${med.drug_name}</td>
          <td class="px-4 py-3 text-slate-600 text-sm">${med.generic_name || '-'}</td>
          <td class="px-4 py-3 text-slate-600 text-sm">${med.dosage_form || '-'}</td>
          <td class="px-4 py-3 text-right number-cell font-bold text-slate-800">${med.unit_cost.toFixed(2)} บ.</td>
          <td class="px-4 py-3 text-center">${statusBadge}</td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            <button onclick="App.openEditMedicineModal(${med.id})"
              class="text-xs text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded border border-teal-200 transition-colors mr-1">
              แก้ไข
            </button>
            <button onclick="App.confirmToggleMedicine(${med.id})"
              class="text-xs ${isAct ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'} px-2 py-1 rounded border transition-colors">
              ${isAct ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAddMedicineModal() {
    document.getElementById('med-modal-title').textContent = '+ เพิ่มรายการยาใหม่';
    document.getElementById('med-modal-id').value = '';
    document.getElementById('med-modal-code').value = '';
    document.getElementById('med-modal-code').disabled = false;
    document.getElementById('med-modal-name').value = '';
    document.getElementById('med-modal-generic').value = '';
    document.getElementById('med-modal-dosage').value = 'Tablet';
    document.getElementById('med-modal-cost').value = '';
    document.getElementById('med-modal-status').value = 'Active';
    document.getElementById('modal-medicine-form').classList.remove('hidden');
  },

  openEditMedicineModal(id) {
    const med = this.medicinesList.find(m => m.id === Number(id));
    if (!med) return;

    document.getElementById('med-modal-title').textContent = `แก้ไขข้อมูลยา: ${med.drug_name}`;
    document.getElementById('med-modal-id').value = med.id;
    document.getElementById('med-modal-code').value = med.drug_code;
    document.getElementById('med-modal-code').disabled = false;
    document.getElementById('med-modal-name').value = med.drug_name;
    document.getElementById('med-modal-generic').value = med.generic_name || '';
    document.getElementById('med-modal-dosage').value = med.dosage_form || 'Tablet';
    document.getElementById('med-modal-cost').value = med.unit_cost;
    document.getElementById('med-modal-status').value = med.status;
    document.getElementById('modal-medicine-form').classList.remove('hidden');
  },

  closeMedicineModal() {
    document.getElementById('modal-medicine-form').classList.add('hidden');
  },

  async saveMedicineForm() {
    const id = document.getElementById('med-modal-id').value;
    const code = document.getElementById('med-modal-code').value.trim();
    const name = document.getElementById('med-modal-name').value.trim();
    const generic = document.getElementById('med-modal-generic').value.trim();
    const dosage = document.getElementById('med-modal-dosage').value.trim();
    const cost = parseFloat(document.getElementById('med-modal-cost').value);
    const status = document.getElementById('med-modal-status').value;

    if (!code) {
      alert('กรุณากรอกรหัสยา');
      return;
    }
    if (!name) {
      alert('กรุณากรอกชื่อยา');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      alert('กรุณาระบุต้นทุนต่อหน่วยให้ถูกต้อง (ต้องไม่น้อยกว่า 0)');
      return;
    }

    try {
      if (id) {
        // Edit
        await HospitalDB.updateMedicine(Number(id), {
          drug_code: code,
          drug_name: name,
          generic_name: generic,
          dosage_form: dosage,
          unit_cost: cost,
          status: status
        });
        this.showToast('แก้ไขข้อมูลยาสำเร็จ');
      } else {
        // Add
        await HospitalDB.addMedicine({
          drug_code: code,
          drug_name: name,
          generic_name: generic,
          dosage_form: dosage,
          unit_cost: cost,
          status: status
        });
        this.showToast('เพิ่มรายการยาใหม่สำเร็จ');
      }

      await this.reloadMedicines();
      this.closeMedicineModal();
      this.renderMedicinesManagement();
    } catch (err) {
      alert(err.message);
    }
  },

  async confirmToggleMedicine(id) {
    const med = this.medicinesList.find(m => m.id === Number(id));
    if (!med) return;

    const actionText = med.status === 'Active' ? 'ปิดการใช้งาน (Inactive)' : 'เปิดการใช้งาน (Active)';
    if (confirm(`ยืนยันการ${actionText} สำหรับยา "${med.drug_name}" (${med.drug_code})?\n\n(รายการยาที่ปิดการใช้งานจะไม่แสดงในหน้าบันทึกรับยาคืน แต่ข้อมูลในอดีตจะยังคงอยู่ครบถ้วน)`)) {
      try {
        await HospitalDB.toggleMedicineStatus(id);
        await this.reloadMedicines();
        this.showToast(`${actionText} สำเร็จ`);
        this.renderMedicinesManagement();
      } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    }
  },

  // ==========================================
  // IMPORT EXCEL / CSV (นำเข้ารายการยา)
  // ==========================================

  importedPreviewItems: [],

  renderImportPage() {
    this.importedPreviewItems = [];
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-preview-container').classList.add('hidden');
    document.getElementById('import-empty-state').classList.remove('hidden');
  },

  async handleFileUpload(file) {
    if (!file) return;

    try {
      const items = await ExcelService.parseMedicineFile(file);
      this.importedPreviewItems = items;

      document.getElementById('import-empty-state').classList.add('hidden');
      const previewContainer = document.getElementById('import-preview-container');
      previewContainer.classList.remove('hidden');

      const validCount = items.filter(i => !i.hasError).length;
      const dupDbCount = items.filter(i => i.isDuplicateInDb).length;
      const errorCount = items.filter(i => i.hasError).length;

      document.getElementById('import-count-total').textContent = `${items.length} รายการ`;
      document.getElementById('import-count-valid').textContent = `${validCount} รายการ`;
      document.getElementById('import-count-dup').textContent = `${dupDbCount} รายการ`;
      document.getElementById('import-count-err').textContent = `${errorCount} รายการ`;

      const tbody = document.getElementById('import-preview-table-body');
      tbody.innerHTML = items.map((item, idx) => {
        let statusBadge = '<span class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">รหัสใหม่ (พร้อมเพิ่มตามไฟล์)</span>';
        let rowClass = 'hover:bg-slate-50';

        if (item.hasError) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">${item.statusMessage || item.errorMessage}</span>`;
          rowClass = 'bg-rose-50/40 text-slate-500';
        } else if (item.isDuplicateInDb) {
          statusBadge = '<span class="px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800">มีรหัสนี้แล้ว (จะอัปเดตชื่อตามไฟล์)</span>';
          rowClass = 'bg-sky-50/30';
        }

        return `
          <tr class="${rowClass} transition-colors border-b border-slate-100">
            <td class="px-3 py-2 text-center text-xs text-slate-400 font-mono">${item.rowNumber}</td>
            <td class="px-3 py-2 font-mono font-bold text-teal-800 text-xs">${item.drug_code}</td>
            <td class="px-3 py-2 font-medium text-slate-800 text-sm">${item.drug_name}</td>
            <td class="px-3 py-2 text-slate-600 text-xs">${item.generic_name || '-'}</td>
            <td class="px-3 py-2 text-slate-600 text-xs">${item.dosage_form || '-'}</td>
            <td class="px-3 py-2 text-right number-cell font-bold text-slate-800 text-sm">${item.unit_cost.toFixed(2)} บ.</td>
            <td class="px-3 py-2 text-center">${statusBadge}</td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      alert('ไม่สามารถอ่านไฟล์ได้: ' + err.message);
    }
  },

  async confirmImportMedicines() {
    const validItems = this.importedPreviewItems.filter(i => !i.hasError);

    if (validItems.length === 0) {
      alert('ไม่มีรายการยาที่สามารถนำเข้าได้ (กรุณาตรวจสอบข้อผิดพลาดในตาราง Preview)');
      return;
    }

    const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'upsert';

    const modeText = importMode === 'replace'
      ? 'แทนที่ฐานข้อมูลยาทั้งหมดด้วยไฟล์นี้'
      : 'อัปเดตและเพิ่มใหม่ตามไฟล์ (รักษารหัสยาเดิม 100%)';

    if (!confirm(`ยืนยันการนำเข้าข้อมูลยาจำนวน ${validItems.length} รายการ?\nรูปแบบ: ${modeText}\n\n* ระบบจะยึดรหัสยาและชื่อยาตามไฟล์ที่นำเข้าทั้งหมด 100% ไม่เปลี่ยนรหัสยา`)) {
      return;
    }

    try {
      if (importMode === 'replace') {
        const count = await HospitalDB.replaceMedicinesCatalog(validItems);
        this.showToast(`แทนที่ฐานข้อมูลยาเรียบร้อยแล้ว (${count} รายการ) โดยยึดรหัสและชื่อตามไฟล์ 100%`);
      } else {
        let count = 0;
        for (const item of validItems) {
          await HospitalDB.upsertMedicine(item);
          count++;
        }
        this.showToast(`นำเข้าและอัปเดตข้อมูลยาสำเร็จ (${count} รายการ) โดยยึดรหัสและชื่อตามไฟล์ 100%`);
      }

      await this.reloadMedicines();
      this.navigate('medicines');
    } catch (err) {
      console.error('Import error:', err);
      alert('เกิดข้อผิดพลาดในการนำเข้า: ' + err.message);
    }
  },

  cancelImport() {
    this.renderImportPage();
  },

  // ==========================================
  // DEDICATED EXPORT PAGE
  // ==========================================

  renderExportPage() {
    const startInput = document.getElementById('export-start-date');
    const endInput = document.getElementById('export-end-date');
    if (startInput && !startInput.value) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      startInput.value = `${y}-${m}-01`;
    }
    if (endInput && !endInput.value) {
      endInput.value = ThaiDate.todayISO();
    }
    this.updateExportSummaryPreview();
  },

  async updateExportSummaryPreview() {
    const startDate = document.getElementById('export-start-date')?.value || '';
    const endDate = document.getElementById('export-end-date')?.value || '';
    const source = document.getElementById('export-source-select')?.value || 'ทั้งหมด';

    const items = await HospitalDB.getAllReturnItemsJoined({ startDate, endDate, source });
    const countEl = document.getElementById('export-preview-count');
    const valueEl = document.getElementById('export-preview-value');

    const totalVal = items.reduce((sum, it) => sum + it.total_value, 0);

    if (countEl) countEl.textContent = ThaiDate.formatNumber(items.length) + ' รายการ';
    if (valueEl) valueEl.textContent = ThaiDate.formatTHB(totalVal);
  },

  async triggerExcelDownload() {
    const startDate = document.getElementById('export-start-date')?.value || '';
    const endDate = document.getElementById('export-end-date')?.value || '';
    const source = document.getElementById('export-source-select')?.value || 'ทั้งหมด';

    const items = await HospitalDB.getAllReturnItemsJoined({ startDate, endDate, source });
    if (items.length === 0) {
      alert('ไม่มีข้อมูลที่ตรงกับเงื่อนไขที่เลือก');
      return;
    }

    const dateRangeStr = `${ThaiDate.formatShort(startDate)} ถึง ${ThaiDate.formatShort(endDate)}`;
    ExcelService.exportReturnsToExcel(items, {
      title: 'รายงานการรับยาคืนจากผู้ป่วย',
      dateRange: dateRangeStr,
      source: source
    });
  },

  // ==========================================
  // 12 TEST CASES RUNNER VIEW
  // ==========================================

  renderTestsPage() {
    const container = document.getElementById('tests-results-container');
    if (container && container.children.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-slate-400">
          <svg class="mx-auto mb-3 text-slate-300" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <p class="font-medium text-slate-600">กดปุ่ม "เริ่มรันการทดสอบทั้งหมด" เพื่อตรวจสอบระบบตาม Test Cases ทั้ง 12 รายการ</p>
        </div>
      `;
    }
  },

  async runAllSystemTests() {
    const container = document.getElementById('tests-results-container');
    const runBtn = document.getElementById('btn-run-all-tests');
    const progressText = document.getElementById('test-progress-text');
    const progressBar = document.getElementById('test-progress-bar');

    runBtn.disabled = true;
    runBtn.classList.add('opacity-50');
    container.innerHTML = '';

    const results = await HospitalTestRunner.runAllTests((entry, allResults) => {
      const pct = Math.round((allResults.length / 12) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `กำลังทดสอบ (${allResults.length}/12): ${entry.name}...`;

      const card = document.createElement('div');
      card.className = `p-4 rounded-xl border mb-3 transition-all fade-in ${
        entry.status === 'PASSED'
          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
          : 'bg-rose-50/60 border-rose-200 text-rose-950'
      }`;

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              entry.status === 'PASSED' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }">
              ${entry.testNum}
            </span>
            <span class="font-bold text-base text-slate-800">Test ${entry.testNum}: ${entry.name}</span>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
            entry.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
          }">
            ${entry.status}
          </span>
        </div>
        <p class="mt-2 text-sm text-slate-600 pl-9 font-medium">${entry.details}</p>
      `;

      container.appendChild(card);
    });

    runBtn.disabled = false;
    runBtn.classList.remove('opacity-50');

    const passedCount = results.filter(r => r.status === 'PASSED').length;
    if (progressText) {
      progressText.innerHTML = `<span class="font-bold text-emerald-700">✓ ทดสอบเสร็จสิ้น: ผ่าน ${passedCount}/12 การทดสอบ</span>`;
    }

    await this.reloadMedicines();
  },

  async resetEntireDatabase() {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตฐานข้อมูลและคืนค่าชุดข้อมูลตัวอย่างเริ่มต้นของโรงพยาบาลร้องกวาง?')) {
      await HospitalDB.resetDatabase();
      await this.reloadMedicines();
      this.showToast('คืนค่าฐานข้อมูลและข้อมูลตัวอย่างเรียบร้อยแล้ว');
      this.renderCurrentView();
    }
  },

  // ==========================================
  // HELPERS & EVENT LISTENERS
  // ==========================================

  initDatePickers() {
    const returnDateInput = document.getElementById('return-date-input');
    if (returnDateInput) {
      returnDateInput.addEventListener('change', (e) => {
        this.updateReturnDateThaiDisplay(e.target.value);
      });
    }
  },

  setupEventListeners() {
    // Navigation items click
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.dataset.view;
        if (view) this.navigate(view);
      });
    });

    // Preset buttons on Dashboard
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setDashboardPreset(btn.dataset.preset);
      });
    });

    // Date range inputs on Dashboard
    const startEl = document.getElementById('dash-start-date');
    const endEl = document.getElementById('dash-end-date');
    if (startEl) {
      startEl.addEventListener('change', () => {
        this.dashboardFilter.startDate = startEl.value;
        this.renderDashboard();
      });
    }
    if (endEl) {
      endEl.addEventListener('change', () => {
        this.dashboardFilter.endDate = endEl.value;
        this.renderDashboard();
      });
    }

    // Source filter on Dashboard
    const sourceEl = document.getElementById('dash-source-select');
    if (sourceEl) {
      sourceEl.addEventListener('change', () => {
        this.dashboardFilter.source = sourceEl.value;
        this.renderDashboard();
      });
    }

    // Report Controls
    const repDateEl = document.getElementById('report-date-input');
    if (repDateEl) {
      repDateEl.value = this.reportFilter.date;
      repDateEl.addEventListener('change', (e) => {
        this.reportFilter.date = e.target.value;
        this.renderReports();
      });
    }

    const repMonthEl = document.getElementById('report-month-select');
    if (repMonthEl) {
      repMonthEl.value = this.reportFilter.month;
      repMonthEl.addEventListener('change', (e) => {
        this.reportFilter.month = e.target.value;
        this.renderReports();
      });
    }

    const repYearEl = document.getElementById('report-year-select');
    if (repYearEl) {
      repYearEl.value = this.reportFilter.year;
      repYearEl.addEventListener('change', (e) => {
        this.reportFilter.year = e.target.value;
        this.renderReports();
      });
    }

    const repSourceEl = document.getElementById('report-source-select');
    if (repSourceEl) {
      repSourceEl.addEventListener('change', (e) => {
        this.reportFilter.source = e.target.value;
        this.renderReports();
      });
    }

    const repSearchEl = document.getElementById('report-search-input');
    if (repSearchEl) {
      repSearchEl.addEventListener('input', (e) => {
        this.reportFilter.search = e.target.value;
        this.renderReports();
      });
    }

    const repSortEl = document.getElementById('report-sort-select');
    if (repSortEl) {
      repSortEl.addEventListener('change', (e) => {
        const [by, order] = e.target.value.split('-');
        this.reportFilter.sortBy = by;
        this.reportFilter.sortOrder = order;
        this.renderReports();
      });
    }

    // File Input for Medicine Import
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // Close search dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-dropdown-container') && !e.target.closest('#return-quick-search-container')) {
        document.querySelectorAll('.search-dropdown-menu').forEach(el => el.classList.add('hidden'));
        const quickDd = document.getElementById('quick-search-dropdown');
        if (quickDd) quickDd.classList.add('hidden');
      }
    });
  },

  showToast(message) {
    const toast = document.getElementById('hospital-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('fade-in');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3500);
  }
};

window.App = App;

// Bootstrap on window load
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
