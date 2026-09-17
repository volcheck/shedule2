import { Doctor } from '../types';
import { useDraggable } from '@dnd-kit/core';

interface Props {
  doctor: Doctor;
  onDelete: (id: string) => void;
}

function DraggableDoctorCard({ doctor, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `doctor-${doctor.id}`,
  });

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: doctor.color }}
      className={`flex items-center justify-between p-2 mb-2 bg-white rounded-lg shadow-sm border-l-4 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-50 shadow-lg scale-105' : 'hover:shadow-md'}`}
      {...listeners}
      {...attributes}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-800 truncate">
          {doctor.lastName} {doctor.firstName.charAt(0)}. {doctor.middleName.charAt(0)}.
        </div>
        {doctor.workplace && (
          <div className="text-xs text-gray-500 truncate">{doctor.workplace}</div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(doctor.id); }}
        className="ml-2 text-red-400 hover:text-red-600 transition p-1"
        onPointerDown={e => e.stopPropagation()}
        title="Удалить врача"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

interface DoctorListProps {
  doctors: Doctor[];
  onDelete: (id: string) => void;
  onAddClick: () => void;
}

export default function DoctorList({ doctors, onDelete, onAddClick }: DoctorListProps) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col max-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 rounded-t-xl px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-800">Список врачей</h3>
          <button
            onClick={onAddClick}
            className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 transition font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Добавить
          </button>
        </div>
        <div className="text-xs text-gray-500 italic">
          Перетащите врача на ячейку графика для назначения дежурства
        </div>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {doctors.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p>Список врачей пуст</p>
            <p className="text-xs">Нажмите «Добавить» для добавления</p>
          </div>
        ) : (
          <div className="space-y-1">
            {doctors.map(doctor => (
              <DraggableDoctorCard key={doctor.id} doctor={doctor} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
