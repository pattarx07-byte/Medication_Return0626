/**
 * Chart Visualization Service using Chart.js
 * ระบบเก็บข้อมูลการรับยาคืนจากผู้ป่วย โรงพยาบาลร้องกวาง
 * Created by Pattaraporn Wongjak
 */

const HospitalCharts = {
  top10ChartInstance: null,
  trendChartInstance: null,
  sourceChartInstance: null,

  /**
   * Render Top 10 Returned Medicines (Horizontal Bar Chart)
   */
  renderTop10(canvasId, dataList) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.top10ChartInstance) {
      this.top10ChartInstance.destroy();
    }

    const labels = dataList.map((item, idx) => `${idx + 1}. ${item.drug_name}`);
    const values = dataList.map(item => item.total_value);
    const quantities = dataList.map(item => item.total_quantity);

    const ctx = canvas.getContext('2d');
    this.top10ChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['ไม่มีข้อมูล'],
        datasets: [{
          label: 'มูลค่าการรับคืน (บาท)',
          data: values.length > 0 ? values : [0],
          backgroundColor: 'rgba(13, 148, 136, 0.85)',
          borderColor: '#0f766e',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y', // Horizontal Bar Chart
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const idx = context.dataIndex;
                const val = ThaiDate.formatTHB(context.raw);
                const qty = quantities[idx] !== undefined ? ThaiDate.formatNumber(quantities[idx]) : '-';
                return [`มูลค่า: ${val}`, `จำนวน: ${qty} หน่วย`];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (value) => ThaiDate.formatNumber(value) + ' ฿',
              font: { family: 'Sarabun' }
            },
            grid: { color: '#f1f5f9' }
          },
          y: {
            ticks: {
              font: { family: 'Prompt', size: 12 },
              color: '#334155'
            },
            grid: { display: false }
          }
        }
      }
    });
  },

  /**
   * Render Monthly Trend Chart (Bar + Line)
   */
  renderMonthlyTrend(canvasId, monthlyData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.trendChartInstance) {
      this.trendChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.trendChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthlyData.months,
        datasets: [
          {
            type: 'bar',
            label: 'มูลค่าการรับคืน (บาท)',
            data: monthlyData.values,
            backgroundColor: 'rgba(2, 132, 199, 0.75)',
            borderColor: '#0284c7',
            borderWidth: 1.5,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'จำนวนยาที่รับคืน (หน่วย)',
            data: monthlyData.units,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Sarabun', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                if (context.dataset.yAxisID === 'y') {
                  return `มูลค่า: ${ThaiDate.formatTHB(context.raw)}`;
                } else {
                  return `จำนวน: ${ThaiDate.formatNumber(context.raw)} หน่วย`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { family: 'Sarabun' } },
            grid: { display: false }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            ticks: {
              callback: (value) => ThaiDate.formatNumber(value) + ' ฿',
              font: { family: 'Sarabun' }
            },
            grid: { color: '#f1f5f9' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: {
              callback: (value) => ThaiDate.formatNumber(value) + ' หน่วย',
              font: { family: 'Sarabun' }
            }
          }
        }
      }
    });
  },

  /**
   * Render Source Comparison Chart (Doughnut / Bar)
   */
  renderSourceDistribution(canvasId, sourceData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (this.sourceChartInstance) {
      this.sourceChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.sourceChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sourceData.labels,
        datasets: [{
          data: sourceData.values,
          backgroundColor: [
            '#0284c7', // OPD Sky blue
            '#f59e0b', // IPD Amber
            '#8b5cf6'  // กล่องยาคืนทั่วไป Purple
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Prompt', size: 12 }, padding: 16 }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const idx = context.dataIndex;
                const label = sourceData.labels[idx];
                const val = ThaiDate.formatTHB(sourceData.values[idx]);
                const units = ThaiDate.formatNumber(sourceData.units[idx]);
                return [`${label}`, `มูลค่า: ${val}`, `จำนวน: ${units} หน่วย`];
              }
            }
          }
        }
      }
    });
  }
};

window.HospitalCharts = HospitalCharts;
