export interface Doctor {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  workplace: string;
  color: string;
}

export interface ScheduleEntry {
  doctorId: string;
  day: number;
  column: number; // 0-7
}

export interface ScheduleData {
  year: number;
  month: number;
  entries: ScheduleEntry[];
}

/**
 * Расширенная запись дня в таблице графика.
 * Может относиться к предыдущему/следующему месяцу.
 */
export interface ExtendedDay {
  day: number;          // число (1-31)
  month: number;        // реальный месяц записи (1-12)
  year: number;         // реальный год записи
  isReadOnly: boolean;  // нельзя редактировать (дни предыдущего месяца для справки)
  isInTargetMonth: boolean; // день относится к текущему выбранному месяцу
  /**
   * Влияет ли день на нагрузку текущего месяца.
   * false для: дней предыдущего месяца, дней января в декабре.
   */
  countsTowardLoad: boolean;
}

export const COLUMNS = [
  'Дневная смена — ответственный дежурный',
  'Ночная смена — ответственный дежурный',
  'Дневная смена — второй дежурный',
  'Ночная смена — второй дежурный',
  'Дневная смена — третий дежурный',
  'Ночная смена — третий дежурный',
  'Дневная смена — врач приёмного отделения',
  'Ночная смена — врач приёмного отделения',
];

export const COLUMN_SHORT = [
  'Отв. дежурный (день)',
  'Отв. дежурный (ночь)',
  'Второй дежурный (день)',
  'Второй дежурный (ночь)',
  'Третий дежурный (день)',
  'Третий дежурный (ночь)',
  'Приёмное отд. (день)',
  'Приёмное отд. (ночь)',
];

export const DAY_SHIFT_COLUMNS = [0, 2, 4, 6]; // дневные смены = 8 часов
export const NIGHT_SHIFT_COLUMNS = [1, 3, 5, 7]; // ночные смены = 16 часов

export const HOURS_DAY = 8;
export const HOURS_NIGHT = 16;

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const MONTHS_SHORT = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
];

/**
 * Получить расширенный список дней для отображения в таблице.
 * - 5 последних дней предыдущего месяца (read-only, не в нагрузке)
 * - все дни текущего месяца (редактируемые, в нагрузке)
 * - для декабря: +14 первых дней января (редактируемые, но НЕ в нагрузке декабря — сохраняются в январь)
 */
export function getExtendedDays(year: number, month: number): ExtendedDay[] {
  const result: ExtendedDay[] = [];

  // 1. Последние 5 дней предыдущего месяца (read-only)
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const prevMonthDaysCount = new Date(prevYear, prevMonth, 0).getDate();
  for (let i = 4; i >= 0; i--) {
    const d = prevMonthDaysCount - i;
    result.push({
      day: d,
      month: prevMonth,
      year: prevYear,
      isReadOnly: true,
      isInTargetMonth: false,
      countsTowardLoad: false,
    });
  }

  // 2. Все дни текущего месяца
  const currentMonthDaysCount = new Date(year, month, 0).getDate();
  for (let d = 1; d <= currentMonthDaysCount; d++) {
    result.push({
      day: d,
      month,
      year,
      isReadOnly: false,
      isInTargetMonth: true,
      countsTowardLoad: true,
    });
  }

  // 3. Для декабря — первые 14 дней января следующего года (редактируемые, но не в нагрузке декабря)
  if (month === 12) {
    for (let d = 1; d <= 14; d++) {
      result.push({
        day: d,
        month: 1,
        year: year + 1,
        isReadOnly: false,
        isInTargetMonth: false,
        countsTowardLoad: false,
      });
    }
  }

  return result;
}
