import { Doctor, ScheduleEntry, ExtendedDay, COLUMN_SHORT, DAY_SHIFT_COLUMNS, MONTHS_SHORT } from '../types';
import { useDroppable, useDraggable } from '@dnd-kit/core';

interface ScheduleTableProps {
  extendedDays: ExtendedDay[];
  entriesByMonth: Record<string, ScheduleEntry[]>;
  doctors: Doctor[];
  targetYear: number;
  targetMonth: number;
  onEntryDrop: (year: number, month: number, day: number, column: number) => void;
  onEntryRemove: (year: number, month: number, day: number, column: number) => void;
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function getDayName(year: number, month: number, day: number): string {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return days[new Date(year, month - 1, day).getDay()];
}

function getEntriesForDay(
  entriesByMonth: Record<string, ScheduleEntry[]>,
  year: number,
  month: number,
  day: number,
  column: number
): ScheduleEntry | undefined {
  const key = `${year}-${month}`;
  const entries = entriesByMonth[key] || [];
  return entries.find(e => e.day === day && e.column === column);
}

function DroppableCell({
  extDay,
  column,
  entry,
  doctor,
  onRemove,
  weekend,
}: {
  extDay: ExtendedDay;
  column: number;
  entry: ScheduleEntry | undefined;
  doctor: Doctor | undefined;
  onRemove: () => void;
  weekend: boolean;
}) {
  const cellId = `cell-${extDay.year}-${extDay.month}-${extDay.day}-${column}`;
  const { setNodeRef, isOver } = useDroppable({ id: cellId });

  const isDayShift = DAY_SHIFT_COLUMNS.includes(column);

  let bgClass = '';
  if (extDay.isReadOnly) {
    bgClass = weekend ? 'bg-amber-50/40 opacity-70' : 'bg-gray-100/70 opacity-70';
  } else if (!extDay.isInTargetMonth) {
    bgClass = weekend ? 'bg-sky-50/60' : 'bg-sky-50/40';
  } else {
    bgClass = weekend ? 'bg-amber-50/60' : (isDayShift ? 'bg-white' : 'bg-gray-50');
  }

  if (isOver && !extDay.isReadOnly) {
    bgClass = 'bg-blue-100 ring-2 ring-blue-400 ring-inset';
  }

  if (!entry || !doctor) {
    return (
      <td
        ref={setNodeRef}
        className={`border border-gray-200 p-0.5 min-w-[110px] h-10 text-center transition-colors ${bgClass}`}
      >
        <div className="h-full flex items-center justify-center text-xs text-gray-300">
          {isOver && !extDay.isReadOnly ? '↓' : ''}
        </div>
      </td>
    );
  }

  return (
    <td
      ref={setNodeRef}
      className={`border border-gray-200 p-0.5 min-w-[110px] h-10 transition-colors ${bgClass}`}
    >
      <DraggableEntry
        entry={entry}
        doctor={doctor}
        extDay={extDay}
        onRemove={onRemove}
      />
    </td>
  );
}

function DraggableEntry({
  entry,
  doctor,
  extDay,
  onRemove,
}: {
  entry: ScheduleEntry;
  doctor: Doctor;
  extDay: ExtendedDay;
  onRemove: () => void;
}) {
  const isReadOnly = extDay.isReadOnly;
  const draggableId = `entry-${extDay.year}-${extDay.month}-${extDay.day}-${entry.column}-${doctor.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: draggableId,
    disabled: isReadOnly,
  });

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    zIndex: isDragging ? 999 : undefined,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: doctor.color, opacity: isReadOnly ? 0.6 : 1 }}
      className={`relative rounded px-1.5 py-0.5 text-white text-xs font-medium ${isReadOnly ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} flex items-center justify-between gap-1 group ${isDragging ? 'opacity-40 shadow-lg' : 'shadow-sm hover:shadow-md'}`}
      {...(isReadOnly ? {} : { ...attributes, ...listeners })}
    >
      <span className="truncate flex-1 select-none">
        {doctor.lastName} {doctor.firstName.charAt(0)}.
      </span>
      {!isReadOnly && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onPointerDown={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/30 rounded px-0.5 hover:bg-white/50 text-white flex-shrink-0"
          title="Удалить"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function ScheduleTable({
  extendedDays,
  entriesByMonth,
  doctors,
  onEntryRemove,
}: ScheduleTableProps) {
  const getDoctor = (doctorId: string) => {
    return doctors.find(d => d.id === doctorId);
  };

  const prevMonthDays = extendedDays.filter(d => !d.isInTargetMonth && d.isReadOnly);
  const targetMonthDays = extendedDays.filter(d => d.isInTargetMonth);
  const nextMonthDays = extendedDays.filter(d => !d.isInTargetMonth && !d.isReadOnly);

  const renderSection = (days: ExtendedDay[], sectionLabel?: string, labelColor?: string) => (
    <>
      {sectionLabel && (
        <tr>
          <td
            colSpan={9}
            className={`px-3 py-1.5 text-xs font-semibold text-center ${labelColor || 'bg-gray-200 text-gray-600'}`}
          >
            {sectionLabel}
          </td>
        </tr>
      )}
      {days.map((extDay) => {
        const weekend = isWeekend(extDay.year, extDay.month, extDay.day);
        const dayName = getDayName(extDay.year, extDay.month, extDay.day);
        const showMonthLabel = !extDay.isInTargetMonth;

        let dayCellBg = '';
        if (extDay.isReadOnly) {
          dayCellBg = weekend ? 'bg-amber-50 opacity-70' : 'bg-gray-100 opacity-70';
        } else if (!extDay.isInTargetMonth) {
          dayCellBg = weekend ? 'bg-sky-50' : 'bg-sky-50/80';
        } else {
          dayCellBg = weekend ? 'bg-amber-50' : 'bg-white';
        }

        return (
          <tr key={`${extDay.year}-${extDay.month}-${extDay.day}`} className={`hover:bg-blue-50/30 ${extDay.isReadOnly ? 'opacity-80' : ''}`}>
            <td className={`border border-gray-200 p-2 text-center sticky left-0 z-10 ${dayCellBg}`}>
              <div className={`text-base ${extDay.isReadOnly ? 'font-bold text-gray-500' : weekend ? 'font-extrabold text-amber-900' : 'font-bold text-gray-700'}`}>
                {extDay.day}
              </div>
              <div className={`text-xs flex flex-col items-center gap-0 ${weekend ? 'text-amber-700 font-bold' : 'text-gray-400 font-normal'}`}>
                <span>{dayName}</span>
                {showMonthLabel && (
                  <span className="text-[10px] text-blue-600 font-semibold">
                    {MONTHS_SHORT[extDay.month - 1]}
                  </span>
                )}
              </div>
            </td>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(col => {
              const entry = getEntriesForDay(entriesByMonth, extDay.year, extDay.month, extDay.day, col);
              const doctor = entry ? getDoctor(entry.doctorId) : undefined;
              return (
                <DroppableCell
                  key={`${extDay.year}-${extDay.month}-${extDay.day}-${col}`}
                  extDay={extDay}
                  column={col}
                  entry={entry}
                  doctor={doctor}
                  onRemove={() => onEntryRemove(extDay.year, extDay.month, extDay.day, col)}
                  weekend={weekend}
                />
              );
            })}
          </tr>
        );
      })}
    </>
  );

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-xl shadow-sm bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <th className="border border-blue-500 p-2 text-center font-semibold sticky left-0 bg-blue-700 z-10 min-w-[70px]">
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
          {prevMonthDays.length > 0 && renderSection(
            prevMonthDays,
            `📋 ${MONTHS_SHORT[prevMonthDays[0].month - 1]} ${prevMonthDays[0].year} — справочно (не редактируется)`,
            'bg-gray-200 text-gray-600'
          )}

          {renderSection(targetMonthDays)}

          {nextMonthDays.length > 0 && renderSection(
            nextMonthDays,
            `🔜 ${MONTHS_SHORT[nextMonthDays[0].month - 1]} ${nextMonthDays[0].year} — редактируется, сохраняется в ${MONTHS_SHORT[nextMonthDays[0].month - 1]}`,
            'bg-sky-100 text-sky-800'
          )}
        </tbody>
      </table>
    </div>
  );
}
