import { Doctor, ScheduleEntry, COLUMNS, MONTHS, HOURS_DAY, HOURS_NIGHT, DAY_SHIFT_COLUMNS } from '../types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface Props {
  doctors: Doctor[];
  entries: ScheduleEntry[];
  year: number;
  month: number;
  days: number[];
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export default function ExportButtons({ doctors, entries, year, month, days }: Props) {
  const getDoctor = (id: string) => doctors.find(d => d.id === id);

  const exportToWord = () => {
    const monthName = MONTHS[month - 1];
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>График дежурств — ${monthName} ${year}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 10pt; }
      h1 { font-size: 14pt; text-align: center; }
      table { border-collapse: collapse; width: 100%; font-size: 8pt; }
      th, td { border: 1px solid #000; padding: 3px 5px; text-align: center; }
      th { background-color: #4472C4; color: white; font-weight: bold; }
      .doctor-cell { padding: 2px 4px; border-radius: 3px; color: white; font-weight: bold; font-size: 8pt; }
    </style></head><body>
    <h1>График дежурств — ${monthName} ${year}</h1>
    <table><thead><tr><th>День</th>`;

    COLUMNS.forEach(col => { html += `<th>${col}</th>`; });
    html += '</tr></thead><tbody>';

    days.forEach(day => {
      html += `<tr><td><b>${day}</b></td>`;
      for (let col = 0; col < 8; col++) {
        const entry = entries.find(e => e.day === day && e.column === col);
        if (entry) {
          const doc = getDoctor(entry.doctorId);
          if (doc) {
            html += `<td><span class="doctor-cell" style="background-color:${doc.color}">${doc.lastName} ${doc.firstName.charAt(0)}. ${doc.middleName.charAt(0)}.</span></td>`;
          } else {
            html += '<td>—</td>';
          }
        } else {
          html += '<td></td>';
        }
      }
      html += '</tr>';
    });

    html += '</tbody></table>';

    // Workload table
    html += '<br/><h2 style="font-size:12pt;">Расчёт нагрузки</h2><table><thead><tr><th>Врач</th><th>Дневных смен</th><th>Ночных смен</th><th>Всего часов</th></tr></thead><tbody>';
    doctors.forEach(doc => {
      const docEntries = entries.filter(e => e.doctorId === doc.id);
      const dayShifts = docEntries.filter(e => DAY_SHIFT_COLUMNS.includes(e.column)).length;
      const nightShifts = docEntries.filter(e => !DAY_SHIFT_COLUMNS.includes(e.column)).length;
      const totalHours = dayShifts * HOURS_DAY + nightShifts * HOURS_NIGHT;
      html += `<tr><td>${doc.lastName} ${doc.firstName} ${doc.middleName}</td><td>${dayShifts}</td><td>${nightShifts}</td><td>${totalHours}</td></tr>`;
    });
    html += '</tbody></table></body></html>';

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `График_дежурств_${monthName}_${year}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const monthName = MONTHS[month - 1];

    doc.setFontSize(14);
    doc.text(`График дежурств — ${monthName} ${year}`, 14, 15);

    const head = [['День', ...COLUMNS]];
    const body: string[][] = [];

    days.forEach(day => {
      const row: string[] = [String(day)];
      for (let col = 0; col < 8; col++) {
        const entry = entries.find(e => e.day === day && e.column === col);
        if (entry) {
          const d = getDoctor(entry.doctorId);
          row.push(d ? `${d.lastName} ${d.firstName.charAt(0)}. ${d.middleName.charAt(0)}.` : '—');
        } else {
          row.push('');
        }
      }
      body.push(row);
    });

    doc.autoTable({
      head,
      body,
      startY: 22,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 12, fontStyle: 'bold' } },
      styles: { overflow: 'linebreak' },
    });

    // Workload section
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(11);
    doc.text('Расчёт нагрузки', 14, finalY + 15);

    const workloadHead = [['Врач', 'Дневных смен', 'Ночных смен', 'Всего часов']];
    const workloadBody: string[][] = [];
    doctors.forEach(d => {
      const docEntries = entries.filter(e => e.doctorId === d.id);
      const dayShifts = docEntries.filter(e => DAY_SHIFT_COLUMNS.includes(e.column)).length;
      const nightShifts = docEntries.filter(e => !DAY_SHIFT_COLUMNS.includes(e.column)).length;
      const totalHours = dayShifts * HOURS_DAY + nightShifts * HOURS_NIGHT;
      workloadBody.push([
        `${d.lastName} ${d.firstName} ${d.middleName}`,
        String(dayShifts),
        String(nightShifts),
        String(totalHours),
      ]);
    });

    doc.autoTable({
      head: workloadHead,
      body: workloadBody,
      startY: finalY + 20,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      bodyStyles: { fontSize: 8 },
    });

    doc.save(`График_дежурств_${monthName}_${year}.pdf`);
  };

  const copyToClipboard = () => {
    const monthName = MONTHS[month - 1];
    let text = `График дежурств — ${monthName} ${year}\n\n`;
    text += 'День\t' + COLUMNS.join('\t') + '\n';

    days.forEach(day => {
      text += `${day}`;
      for (let col = 0; col < 8; col++) {
        const entry = entries.find(e => e.day === day && e.column === col);
        if (entry) {
          const d = getDoctor(entry.doctorId);
          text += '\t' + (d ? `${d.lastName} ${d.firstName.charAt(0)}. ${d.middleName.charAt(0)}.` : '—');
        } else {
          text += '\t';
        }
      }
      text += '\n';
    });

    text += '\n\nРасчёт нагрузки:\n';
    text += 'Врач\tДневных смен\tНочных смен\tВсего часов\n';
    doctors.forEach(d => {
      const docEntries = entries.filter(e => e.doctorId === d.id);
      const dayShifts = docEntries.filter(e => DAY_SHIFT_COLUMNS.includes(e.column)).length;
      const nightShifts = docEntries.filter(e => !DAY_SHIFT_COLUMNS.includes(e.column)).length;
      const totalHours = dayShifts * HOURS_DAY + nightShifts * HOURS_NIGHT;
      text += `${d.lastName} ${d.firstName} ${d.middleName}\t${dayShifts}\t${nightShifts}\t${totalHours}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      alert('График скопирован в буфер обмена!');
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('График скопирован в буфер обмена!');
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={copyToClipboard}
        className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition font-medium shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        Копировать
      </button>
      <button
        onClick={exportToWord}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V16a2 2 0 01-2 2z" />
        </svg>
        Сохранить в Word
      </button>
      <button
        onClick={exportToPDF}
        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Сохранить в PDF
      </button>
    </div>
  );
}
