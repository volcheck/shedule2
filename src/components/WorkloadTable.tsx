import { Doctor, ScheduleEntry, HOURS_DAY, HOURS_NIGHT, DAY_SHIFT_COLUMNS } from '../types';

interface Props {
  doctors: Doctor[];
  entries: ScheduleEntry[];
}

interface WorkloadEntry {
  doctor: Doctor;
  dayShifts: number;
  nightShifts: number;
  totalHours: number;
}

export default function WorkloadTable({ doctors, entries }: Props) {
  const workload: WorkloadEntry[] = doctors.map(doctor => {
    const doctorEntries = entries.filter(e => e.doctorId === doctor.id);
    const dayShifts = doctorEntries.filter(e => DAY_SHIFT_COLUMNS.includes(e.column)).length;
    const nightShifts = doctorEntries.filter(e => !DAY_SHIFT_COLUMNS.includes(e.column)).length;
    const totalHours = dayShifts * HOURS_DAY + nightShifts * HOURS_NIGHT;
    return { doctor, dayShifts, nightShifts, totalHours };
  });

  // Sort by total hours descending
  workload.sort((a, b) => b.totalHours - a.totalHours);

  const maxHours = Math.max(...workload.map(w => w.totalHours), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-3">
        <h3 className="font-bold text-lg">Расчёт нагрузки (часы)</h3>
        <p className="text-emerald-100 text-xs mt-0.5">
          Дневная смена = {HOURS_DAY} ч. | Ночная смена = {HOURS_NIGHT} ч.
        </p>
      </div>
      {workload.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          Нет данных для расчёта
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-semibold text-gray-700">Врач</th>
                <th className="p-3 text-center font-semibold text-gray-700">Дневных смен</th>
                <th className="p-3 text-center font-semibold text-gray-700">Ночных смен</th>
                <th className="p-3 text-center font-semibold text-gray-700">Всего часов</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-48">Нагрузка</th>
              </tr>
            </thead>
            <tbody>
              {workload.map(({ doctor, dayShifts, nightShifts, totalHours }) => (
                <tr key={doctor.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: doctor.color }}
                      />
                      <span className="font-medium text-gray-800">
                        {doctor.lastName} {doctor.firstName.charAt(0)}. {doctor.middleName.charAt(0)}.
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {dayShifts}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {nightShifts}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-bold text-gray-800">{totalHours}</span>
                    <span className="text-gray-500 text-xs ml-1">ч.</span>
                  </td>
                  <td className="p-3">
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(totalHours / maxHours) * 100}%`,
                          backgroundColor: doctor.color,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="p-3 text-gray-700">ИТОГО</td>
                <td className="p-3 text-center text-gray-700">
                  {workload.reduce((sum, w) => sum + w.dayShifts, 0)}
                </td>
                <td className="p-3 text-center text-gray-700">
                  {workload.reduce((sum, w) => sum + w.nightShifts, 0)}
                </td>
                <td className="p-3 text-center text-gray-800">
                  {workload.reduce((sum, w) => sum + w.totalHours, 0)} ч.
                </td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
