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
