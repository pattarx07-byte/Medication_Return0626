/**
 * Thai Date and Currency Formatting Utilities
 * สำหรับระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย โรงพยาบาลร้องกวาง
 * Created by Pattaraporn Wongjak
 */

const ThaiDate = {
  monthsFull: [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ],

  monthsShort: [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ],

  /**
   * Convert ISO Date string (YYYY-MM-DD) to Thai Buddhist Era formatted string
   * Example: '2026-09-05' -> '05/09/2569'
   */
  formatShort(isoDate) {
    if (!isoDate) return '-';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const yearCE = parseInt(parts[0], 10);
    const month = parts[1];
    const day = parts[2];
    const yearBE = yearCE + 543;
    return `${day}/${month}/${yearBE}`;
  },

  /**
   * Convert ISO Date string to Full Thai Date string
   * Example: '2026-09-05' -> '5 กันยายน 2569'
   */
  formatFull(isoDate) {
    if (!isoDate) return '-';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const yearCE = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const yearBE = yearCE + 543;
    const monthName = this.monthsFull[monthIndex] || parts[1];
    return `${day} ${monthName} ${yearBE}`;
  },

  /**
   * Get Thai Month & Year
   * Example: (9, 2026) -> 'กันยายน 2569'
   */
  formatMonthYear(month, yearCE) {
    const monthIndex = parseInt(month, 10) - 1;
    const yearBE = parseInt(yearCE, 10) + 543;
    return `${this.monthsFull[monthIndex] || month} ${yearBE}`;
  },

  /**
   * Convert Buddhist Era year to Common Era year (BE - 543)
   */
  beToCe(yearBE) {
    return parseInt(yearBE, 10) - 543;
  },

  /**
   * Convert Common Era year to Buddhist Era year (CE + 543)
   */
  ceToBe(yearCE) {
    return parseInt(yearCE, 10) + 543;
  },

  /**
   * Get today's date in ISO format YYYY-MM-DD
   */
  todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Format number as currency THB: 1,250.50 บาท
   */
  formatTHB(amount, includeSymbol = true) {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return includeSymbol ? '0.00 บาท' : '0.00';
    }
    const formatted = Number(amount).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return includeSymbol ? `${formatted} บาท` : formatted;
  },

  /**
   * Format number with thousands separator: 1,250
   */
  formatNumber(number) {
    if (number === undefined || number === null || isNaN(number)) {
      return '0';
    }
    return Number(number).toLocaleString('th-TH');
  }
};

window.ThaiDate = ThaiDate;
