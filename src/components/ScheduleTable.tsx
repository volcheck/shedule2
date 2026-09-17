import { Doctor, ScheduleEntry, COLUMN_SHORT, DAY_SHIFT_COLUMNS } from '../types';
import { useDroppable, useDraggable } from '@dnd-kit/core';

interface ScheduleTableProps {
  days: number[];
  entries: ScheduleEntry[];
  doctors: Doctor[];
  onEntryDrop: (day: number, column: number) => void;
  onEntryRemove: (day: number, column: number) => void;
  onEntryMove: (fromDay: number, fromCol: number, toDay: number, toCol: number) => void;
}

function DroppableCell({
  day,
  column,
  entry,
  doctor,
  onRemove,
}: {
  day: number;
  column: number;
  entry: ScheduleEntry | undefined;
  doctor: Doctor | undefined;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${day}-${column}`,
    data: { day, column },
  });

  const isDayShift = DAY_SHIFT_COLUMNS.includes(column);

  if (!entry || !doctor) {
    return (
      <td
        ref={setNodeRef}
        className={`border border-gray-200 p-0.5 min-w-[110px] h-10 text-center transition-colors ${isOver ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : isDayShift ? 'bg-white' : 'bg-gray-50'}`}
      >
        <div className="h-full flex items-center justify-center text-xs text-gray-300">
          {isOver ? '↓' : ''}
        </div>
      </td>
    );
  }

  return (
    <td
      ref={setNodeRef}
      className={`border border-gray-200 p-0.5 min-w-[110px] h-10 transition-colors ${isOver ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
    >
      <DraggableEntry entry={entry} doctor={doctor} onRemove={onRemove} />
    </td>
  );
}

function DraggableEntry({
  entry,
  doctor,
  onRemove,
}: {
  entry: ScheduleEntry;
  doctor: Doctor;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `entry-${entry.day}-${entry.column}`,
    data: { entry, doctor },
  });

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    zIndex: isDragging ? 999 : undefined,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: doctor.color }}
      className={`relative rounded px-1.5 py-0.5 text-white text-xs font-medium cursor-grab active:cursor-grabbing flex items-center justify-between gap-1 group ${isDragging ? 'opacity-40 shadow-lg' : 'shadow-sm hover:shadow-md'}`}
      {...attributes}
      {...listeners}
    >
      <span className="truncate flex-1 select-none">
        {doctor.lastName} {doctor.firstName.charAt(0)}.
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={e => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/30 rounded px-0.5 hover:bg-white/50 text-white flex-shrink-0"
        title="Удалить"
      >
        ×
      </button>
    </div>
  );
}

export default function ScheduleTable({
  days,
  entries,
  doctors,
  onEntryRemove,
}: ScheduleTableProps) {
  const getEntry = (day: number, column: number) => {
    return entries.find(e => e.day === day && e.column === column);
  };

  const getDoctor = (doctorId: string) => {
    return doctors.find(d => d.id === doctorId);
  };

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-xl shadow-sm bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <th className="border border-blue-500 p-2 text-center font-semibold sticky left-0 bg-blue-700 z-10 min-w-[50px]">
              День
            </th>
            {COLUMN_SHORT.map((col, idx) => (
              <th
                key={idx}
                className={`border border-blue-500 p-2 text-center font-medium text-xs min-w-[120px] ${DAY_SHIFT_COLUMNS.includes(idx) ? '' : 'bg-blue-800/20'}`}
                title={col}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map(day => (
            <tr key={day} className="hover:bg-blue-50/30">
              <td className="border border-gray-200 p-2 text-center font-bold text-gray-700 sticky left-0 bg-white z-10">
                {day}
              </td>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(col => {
                const entry = getEntry(day, col);
                const doctor = entry ? getDoctor(entry.doctorId) : undefined;
                return (
                  <DroppableCell
                    key={`${day}-${col}`}
                    day={day}
                    column={col}
                    entry={entry}
                    doctor={doctor}
                    onRemove={() => onEntryRemove(day, col)}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
