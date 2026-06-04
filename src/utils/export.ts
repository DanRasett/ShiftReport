import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SavedReport } from '../types';

const formatNum = (n: number) => n.toLocaleString('ru-RU');

// Экспорт зарплатной ведомости в Excel
export const exportSalaryToExcel = async (
  salaryData: Record<string, {
    base: number; percent: number; goodsExpenses: number; cashExpenses: number;
    totalDiff: number; fines: { amount: number; reason: string; date: string }[];
    total: number; shifts: SavedReport[];
    shortageTotal?: number;
    goodsDetails?: { name: string; quantity: number; total: number }[];
  }>,
  fromDate: string,
  toDate: string
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ShiftReport';

  // Лист "Зарплата"
  const ws = workbook.addWorksheet('Зарплата');

  // Заголовок
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `Зарплатная ведомость за период ${fromDate} - ${toDate}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  // Шапка таблицы
  const headerRow = ws.addRow(['Сотрудник', 'Смен', 'Базовая ставка', 'Процент', 'Товары под ЗП', 'Деньги из кассы', 'Штрафы', 'Недостача', 'Итого']);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF93' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  // Данные
  Object.entries(salaryData).forEach(([worker, data]) => {
    const totalFines = data.fines.reduce((s, f) => s + f.amount, 0);
    ws.addRow([
      worker,
      data.shifts.length,
      data.base,
      data.percent,
      data.goodsExpenses,
      data.cashExpenses,
      totalFines,
      data.shortageTotal || 0,
      data.total,
    ]);
  });

  // Итого
  const totalRow = ws.addRow([
    'ИТОГО',
    '',
    Object.values(salaryData).reduce((s, d) => s + d.base, 0),
    Object.values(salaryData).reduce((s, d) => s + d.percent, 0),
    Object.values(salaryData).reduce((s, d) => s + d.goodsExpenses, 0),
    Object.values(salaryData).reduce((s, d) => s + d.cashExpenses, 0),
    Object.values(salaryData).reduce((s, d) => s + d.fines.reduce((a, f) => a + f.amount, 0), 0),
    Object.values(salaryData).reduce((s, d) => s + (d.shortageTotal || 0), 0),
    Object.values(salaryData).reduce((s, d) => s + d.total, 0),
  ]);
  totalRow.font = { bold: true };

  // Ширина колонок
  ws.columns.forEach(col => { col.width = 18; });

  // Сохраняем
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Зарплата_${fromDate}_${toDate}.xlsx`);
};

// Экспорт отчёта в текстовый файл (для печати)
export const exportReportToText = (report: SavedReport) => {
  const text = `Сдача смены
Сотрудник: ${report.workerName || '—'}
Дата: ${new Date(report.date).toLocaleString('ru-RU')}
---
Дэш: ${formatNum(report.dashTotal)} ₽
Нал: ${formatNum(report.dashCash)} ₽
Карта: ${formatNum(report.dashCashless)} ₽
---
Факт: ${formatNum(report.factTotal)} ₽
Нал: ${formatNum(report.factCash)} ₽
Карта: ${formatNum(report.factCashless)} ₽
Уборщица: ${formatNum(report.cleanerAmount || 0)} ₽
Недостача: ${formatNum(report.shortageAmount || 0)} ₽
---
Взято товарами:
${(report.goodsTaken || []).map(g => `${g.workerName || '—'}: ${g.name} ×${g.quantity} = ${formatNum(g.quantity * g.price)} ₽`).join('\n') || '—'}
Взято деньгами:
${(report.cashTakenItems || []).map(c => `${c.workerName || '—'}: ${formatNum(c.amount)} ₽`).join('\n') || '—'}
---
2%: ${formatNum(report.twoPercent)} ₽
${report.difference > 0 ? 'Пересдача' : 'Недосдача'}: ${formatNum(report.difference)} ₽
---
${report.fine ? `Штраф: ${formatNum(report.fine.amount)} ₽ — ${report.fine.reason}` : ''}`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `Отчёт_${new Date(report.date).toISOString().slice(0, 10)}.txt`);
};