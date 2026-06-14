import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SavedReport } from '../types';

const formatNum = (n: number) => n.toLocaleString('ru-RU');

// Экспорт всей истории в Excel с тремя вкладками
export const exportHistoryToExcel = async (reports: SavedReport[]) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ShiftReport';

  // Стили для заголовков
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4CAF93' } },
  };

  const headers = ['Дата', 'Сотрудник', 'Дэш нал', 'Дэш карта', 'Дэш всего', 'Факт нал', 'Факт карта', 'Факт всего', '2%', 'Пересдача/Недосдача', 'Уборщица', 'Переводы', 'Товары под ЗП', 'Деньги из кассы', 'Штраф', 'Статус'];

  // Вкладка 1: Все отчёты
  addSheet(workbook, 'Все смены', reports, headers, headerStyle);

  // Вкладка 2: Выплаченные
  const paid = reports.filter(r => r.salaryPaid === true);
  addSheet(workbook, 'Выплаченные', paid, headers, headerStyle);

  // Вкладка 3: Не выплаченные
  const unpaid = reports.filter(r => r.salaryPaid !== true);
  addSheet(workbook, 'Не выплаченные', unpaid, headers, headerStyle);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `История_смен_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

function addSheet(workbook: ExcelJS.Workbook, name: string, reports: SavedReport[], headers: string[], headerStyle: any) {
  const ws = workbook.addWorksheet(name);

  // Заголовок
  ws.mergeCells('A1:P1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${name} (${reports.length} смен)`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  // Шапка
  const headerRow = ws.addRow(headers);
  headerRow.eachCell(cell => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
  });

  // Данные
  reports.forEach(r => {
    const goodsText = (r.goodsTaken || []).map(g => `${g.name} ×${g.quantity}`).join('; ');
    const cashText = (r.cashTakenItems || []).map(c => `${formatNum(c.amount)} ₽`).join('; ');
    const fineText = r.fine ? `${formatNum(r.fine.amount)} ₽ — ${r.fine.reason}` : '';

    ws.addRow([
      new Date(r.date).toLocaleString('ru-RU'),
      r.workerName || '—',
      r.dashCash,
      r.dashCashless,
      r.dashTotal,
      r.factCash,
      r.factCashless,
      r.factTotal,
      r.twoPercent,
      r.difference,
      r.cleanerAmount || 0,
      r.transfers || 0,
      goodsText,
      cashText,
      fineText,
      r.salaryPaid ? 'Выплачено' : 'Не выплачено',
    ]);
  });

  // Итого
  const totalRow = ws.addRow([
    'ИТОГО', '', 
    reports.reduce((s, r) => s + r.dashCash, 0),
    reports.reduce((s, r) => s + r.dashCashless, 0),
    reports.reduce((s, r) => s + r.dashTotal, 0),
    reports.reduce((s, r) => s + r.factCash, 0),
    reports.reduce((s, r) => s + r.factCashless, 0),
    reports.reduce((s, r) => s + r.factTotal, 0),
    reports.reduce((s, r) => s + r.twoPercent, 0),
    reports.reduce((s, r) => s + r.difference, 0),
    reports.reduce((s, r) => s + (r.cleanerAmount || 0), 0),
    reports.reduce((s, r) => s + (r.transfers || 0), 0),
    '', '', '', '',
  ]);
  totalRow.font = { bold: true };

  ws.columns.forEach(col => { col.width = 16; });
}

// Генерация текста отчёта для копирования
export const getReportText = (report: SavedReport): string => {
  return `Сдача смены
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
Переводы: ${formatNum(report.transfers || 0)} ₽
Уборщица: ${formatNum(report.cleanerAmount || 0)} ₽
---
Взято товарами:
${(report.goodsTaken || []).map(g => `${g.workerName || '—'}: ${g.name} ×${g.quantity} = ${formatNum(g.quantity * g.price)} ₽`).join('\n') || '—'}
Взято деньгами:
${(report.cashTakenItems || []).map(c => `${c.workerName || '—'}: ${formatNum(c.amount)} ₽`).join('\n') || '—'}
---
2%: ${formatNum(report.twoPercent)} ₽
${report.difference > 0 ? 'Пересдача' : 'Недосдача'}: ${formatNum(report.difference)} ₽
${report.fine ? `Штраф: ${formatNum(report.fine.amount)} ₽ — ${report.fine.reason}` : ''}
Статус: ${report.salaryPaid ? 'Выплачено' : 'Не выплачено'}`;
};

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