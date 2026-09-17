import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { Doctor, ScheduleEntry, MONTHS } from './types';
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

function getDaysInMonth(year: number, month: number): number[] {
  const daysCount = new Date(year, month, 0).getDate();
  return Array.from({ length: daysCount }, (_, i) => i + 1);
}

function App() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [doctors, setDoctors] = useState<Doctor[]>(() => getDoctors());
  const [entries, setEntries] = useState<ScheduleEntry[]>(() => getEntriesForMonth(currentYear, currentMonth));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const [activeEntry, setActiveEntry] = useState<{ entry: ScheduleEntry; doctor: Doctor } | null>(null);

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    setEntries(getEntriesForMonth(newYear, newMonth));
  }, []);

  const handleAddDoctor = useCallback((doctor: Doctor) => {
    storeAddDoctor(doctor);
    setDoctors(getDoctors());
  }, []);

  const handleDeleteDoctor = useCallback((id: string) => {
    if (!confirm('Удалить врача? Все его назначения в графике будут удалены.')) return;
    storeDeleteDoctor(id);
    setDoctors(getDoctors());
    setEntries(getEntriesForMonth(year, month));
  }, [year, month]);

  const saveCurrentEntries = useCallback((newEntries: ScheduleEntry[]) => {
    setEntries(newEntries);
    saveEntriesForMonth(year, month, newEntries);
  }, [year, month]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.doctor && !data?.entry) {
      setActiveDoctor(data.doctor);
    } else if (data?.entry && data?.doctor) {
      setActiveEntry({ entry: data.entry, doctor: data.doctor });
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDoctor(null);
    setActiveEntry(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Check if we're dropping on a cell
    if (overData?.day === undefined || overData?.column === undefined) return;

    const targetDay = overData.day;
    const targetCol = overData.column;

    // Dragging from doctor list to cell
    if (activeData?.doctor && !activeData?.entry) {
      const newEntries = [...entries];

      // Remove existing entry at target if any
      const existingIdx = newEntries.findIndex(e => e.day === targetDay && e.column === targetCol);
      if (existingIdx !== -1) {
        newEntries.splice(existingIdx, 1);
      }

      // Add new entry
      newEntries.push({
        doctorId: activeData.doctor.id,
        day: targetDay,
        column: targetCol,
      });

      saveCurrentEntries(newEntries);
      return;
    }

    // Dragging existing entry to another cell (swap)
    if (activeData?.entry) {
      const fromDay = activeData.entry.day;
      const fromCol = activeData.entry.column;

      if (fromDay === targetDay && fromCol === targetCol) return;

      const newEntries = [...entries];
      const fromIdx = newEntries.findIndex(e => e.day === fromDay && e.column === fromCol);
      const toIdx = newEntries.findIndex(e => e.day === targetDay && e.column === targetCol);

      if (fromIdx !== -1) {
        if (toIdx !== -1) {
          // Swap positions
          const tempDoctorId = newEntries[fromIdx].doctorId;
          newEntries[fromIdx] = { ...newEntries[fromIdx], doctorId: newEntries[toIdx].doctorId };
          newEntries[toIdx] = { ...newEntries[toIdx], doctorId: tempDoctorId };
        } else {
          // Move to empty cell
          newEntries[fromIdx] = { ...newEntries[fromIdx], day: targetDay, column: targetCol };
        }
      }

      saveCurrentEntries(newEntries);
      return;
    }
  }, [entries, saveCurrentEntries]);

  const handleEntryRemove = useCallback((day: number, column: number) => {
    const newEntries = entries.filter(e => !(e.day === day && e.column === column));
    saveCurrentEntries(newEntries);
  }, [entries, saveCurrentEntries]);

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
            {/* Sidebar - Doctor List */}
            <aside>
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
                    entries={entries}
                    year={year}
                    month={month}
                    days={days}
                  />
                </div>
                <ScheduleTable
                  days={days}
                  entries={entries}
                  doctors={doctors}
                  onEntryDrop={() => {}}
                  onEntryRemove={handleEntryRemove}
                  onEntryMove={() => {}}
                />
              </div>

              {/* Workload Table */}
              <WorkloadTable doctors={doctors} entries={entries} />
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
