import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { Doctor, ScheduleEntry, MONTHS, getExtendedDays } from './types';
import {
  getDoctors,
  addDoctor as storeAddDoctor,
  deleteDoctor as storeDeleteDoctor,
  getEntriesForMonth,
  saveEntriesForMonth,
} from './store';
import DoctorList from './components/DoctorList';
import AddDoctorModal from './components/AddDoctorModal';
import ScheduleTable from './components/ScheduleTable';
import WorkloadTable from './components/WorkloadTable';
import ExportButtons from './components/ExportButtons';

function App() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [doctors, setDoctors] = useState<Doctor[]>(() => getDoctors());
  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, ScheduleEntry[]>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const [activeEntry, setActiveEntry] = useState<{ entry: ScheduleEntry; doctor: Doctor; year: number; month: number } | null>(null);

  const extendedDays = useMemo(() => getExtendedDays(year, month), [year, month]);

  // Загрузка записей для всех нужных месяцев
  const loadEntries = useCallback((y: number, m: number) => {
    const days = getExtendedDays(y, m);
    const monthsToLoad = new Set<string>();
    days.forEach(d => monthsToLoad.add(`${d.year}-${d.month}`));

    const newEntries: Record<string, ScheduleEntry[]> = {};
    monthsToLoad.forEach(key => {
      const [yr, mo] = key.split('-').map(Number);
      newEntries[key] = getEntriesForMonth(yr, mo);
    });
    setEntriesByMonth(newEntries);
  }, []);

  // Первоначальная загрузка
  useEffect(() => {
    loadEntries(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  }, []);

  const handleAddDoctor = useCallback((doctor: Doctor) => {
    storeAddDoctor(doctor);
    setDoctors(getDoctors());
  }, []);

  const handleDeleteDoctor = useCallback((id: string) => {
    if (!confirm('Удалить врача? Все его назначения в графике будут удалены.')) return;
    storeDeleteDoctor(id);
    setDoctors(getDoctors());
    loadEntries(year, month);
  }, [year, month, loadEntries]);

  const saveEntry = useCallback((targetYear: number, targetMonth: number, newEntries: ScheduleEntry[]) => {
    saveEntriesForMonth(targetYear, targetMonth, newEntries);
    setEntriesByMonth(prev => ({
      ...prev,
      [`${targetYear}-${targetMonth}`]: newEntries,
    }));
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const id = String(active.id);

    // Из списка врачей
    if (id.startsWith('doctor-')) {
      const doctorId = id.replace('doctor-', '');
      const doctor = doctors.find(d => d.id === doctorId);
      if (doctor) setActiveDoctor(doctor);
      return;
    }

    // Из таблицы (entry-year-month-day-column-doctorId)
    if (id.startsWith('entry-')) {
      const parts = id.split('-');
      // entry-YEAR-MONTH-DAY-COLUMN-DOCTORID
      const entryYear = parseInt(parts[1]);
      const entryMonth = parseInt(parts[2]);
      const entryDay = parseInt(parts[3]);
      const entryColumn = parseInt(parts[4]);
      const doctorId = parts.slice(5).join('-');

      const key = `${entryYear}-${entryMonth}`;
      const entries = entriesByMonth[key] || [];
      const entry = entries.find(e => e.day === entryDay && e.column === entryColumn);
      const doctor = doctors.find(d => d.id === doctorId);

      if (entry && doctor) {
        setActiveEntry({ entry, doctor, year: entryYear, month: entryMonth });
      }
    }
  }, [doctors, entriesByMonth]);

  const parseCellId = (cellId: string): { year: number; month: number; day: number; column: number } | null => {
    if (!cellId.startsWith('cell-')) return null;
    const parts = cellId.split('-');
    return {
      year: parseInt(parts[1]),
      month: parseInt(parts[2]),
      day: parseInt(parts[3]),
      column: parseInt(parts[4]),
    };
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDoctor(null);
    setActiveEntry(null);

    if (!over) return;

    const overId = String(over.id);
    const target = parseCellId(overId);
    if (!target) return;

    // Проверка: нельзя редактировать read-only дни
    const targetExtDay = extendedDays.find(d =>
      d.year === target.year && d.month === target.month && d.day === target.day
    );
    if (targetExtDay?.isReadOnly) return;

    const activeId = String(active.id);

    // Drag from doctor list
    if (activeId.startsWith('doctor-')) {
      const doctorId = activeId.replace('doctor-', '');
      const key = `${target.year}-${target.month}`;
      const currentEntries = [...(entriesByMonth[key] || [])];

      // Remove existing entry at target
      const existingIdx = currentEntries.findIndex(e => e.day === target.day && e.column === target.column);
      if (existingIdx !== -1) {
        currentEntries.splice(existingIdx, 1);
      }

      // Add new entry
      currentEntries.push({
        doctorId,
        day: target.day,
        column: target.column,
      });

      saveEntry(target.year, target.month, currentEntries);
      return;
    }

    // Drag from table (swap or move)
    if (activeId.startsWith('entry-') && activeEntry) {
      const fromYear = activeEntry.year;
      const fromMonth = activeEntry.month;
      const fromDay = activeEntry.entry.day;
      const fromCol = activeEntry.entry.column;

      if (fromYear === target.year && fromMonth === target.month && fromDay === target.day && fromCol === target.column) {
        return; // Same cell
      }

      const fromKey = `${fromYear}-${fromMonth}`;
      const toKey = `${target.year}-${target.month}`;

      const fromEntries = [...(entriesByMonth[fromKey] || [])];
      const toEntries = fromKey === toKey ? fromEntries : [...(entriesByMonth[toKey] || [])];

      const fromIdx = fromEntries.findIndex(e => e.day === fromDay && e.column === fromCol);
      if (fromIdx === -1) return;

      const toIdx = toEntries.findIndex(e => e.day === target.day && e.column === target.column);

      if (fromKey === toKey) {
        // Same month
        if (toIdx !== -1) {
          // Swap
          const tempDoctorId = fromEntries[fromIdx].doctorId;
          fromEntries[fromIdx] = { ...fromEntries[fromIdx], doctorId: fromEntries[toIdx].doctorId };
          fromEntries[toIdx] = { ...fromEntries[toIdx], doctorId: tempDoctorId };
        } else {
          // Move
          fromEntries[fromIdx] = { ...fromEntries[fromIdx], day: target.day, column: target.column };
        }
        saveEntry(fromYear, fromMonth, fromEntries);
      } else {
        // Different months
        const movedEntry = fromEntries[fromIdx];
        fromEntries.splice(fromIdx, 1);

        if (toIdx !== -1) {
          // Swap between months
          const swappedEntry = toEntries[toIdx];
          toEntries[toIdx] = { ...movedEntry, day: target.day, column: target.column };
          fromEntries.push({ ...swappedEntry, day: fromDay, column: fromCol });
        } else {
          // Move to different month
          toEntries.push({ ...movedEntry, day: target.day, column: target.column });
        }

        saveEntry(fromYear, fromMonth, fromEntries);
        if (fromKey !== toKey) {
          saveEntry(target.year, target.month, toEntries);
        }
      }
    }
  }, [activeEntry, entriesByMonth, extendedDays, saveEntry]);

  const handleEntryRemove = useCallback((targetYear: number, targetMonth: number, day: number, column: number) => {
    const key = `${targetYear}-${targetMonth}`;
    const currentEntries = entriesByMonth[key] || [];
    const newEntries = currentEntries.filter(e => !(e.day === day && e.column === column));
    saveEntry(targetYear, targetMonth, newEntries);
  }, [entriesByMonth, saveEntry]);

  // Записи только для текущего месяца (для workload и export)
  const targetMonthEntries = entriesByMonth[`${year}-${month}`] || [];

  // Все дни текущего месяца (для workload)
  const currentMonthDays = extendedDays.filter(d => d.isInTargetMonth);
  const daysForExport = currentMonthDays.map(d => d.day);

  const years = Array.from({ length: 10 }, (_, i) => currentYear - 3 + i);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-3xl">🏥</span>
                  График дежурств врачей
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Система планирования и управления дежурствами</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600">Месяц:</label>
                <select
                  value={month}
                  onChange={e => handleMonthChange(year, parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>
                <label className="text-sm font-medium text-gray-600">Год:</label>
                <select
                  value={year}
                  onChange={e => handleMonthChange(parseInt(e.target.value), month)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-full mx-auto px-4 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
            {/* Sidebar - Doctor List (sticky) */}
            <aside className="xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
              <DoctorList
                doctors={doctors}
                onDelete={handleDeleteDoctor}
                onAddClick={() => setIsModalOpen(true)}
              />
            </aside>

            {/* Schedule Table */}
            <div className="space-y-6">
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
                  <h2 className="text-lg font-bold text-gray-800">
                    График на {MONTHS[month - 1]} {year}
                  </h2>
                  <ExportButtons
                    doctors={doctors}
                    entries={targetMonthEntries}
                    year={year}
                    month={month}
                    days={daysForExport}
                  />
                </div>
                <ScheduleTable
                  extendedDays={extendedDays}
                  entriesByMonth={entriesByMonth}
                  doctors={doctors}
                  targetYear={year}
                  targetMonth={month}
                  onEntryDrop={() => {}}
                  onEntryRemove={handleEntryRemove}
                />
              </div>

              {/* Workload Table */}
              <WorkloadTable doctors={doctors} entries={targetMonthEntries} />
            </div>
          </div>
        </main>

        {/* Modal */}
        <AddDoctorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAdd={handleAddDoctor}
        />

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDoctor && (
            <div
              className="px-3 py-2 rounded-lg shadow-xl text-white text-sm font-medium whitespace-nowrap"
              style={{ backgroundColor: activeDoctor.color }}
            >
              {activeDoctor.lastName} {activeDoctor.firstName.charAt(0)}. {activeDoctor.middleName.charAt(0)}.
            </div>
          )}
          {activeEntry && (
            <div
              className="px-3 py-2 rounded-lg shadow-xl text-white text-sm font-medium whitespace-nowrap"
              style={{ backgroundColor: activeEntry.doctor.color }}
            >
              {activeEntry.doctor.lastName} {activeEntry.doctor.firstName.charAt(0)}. {activeEntry.doctor.middleName.charAt(0)}.
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

export default App;
