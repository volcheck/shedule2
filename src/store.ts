import { Doctor, ScheduleEntry } from './types';

const DOCTORS_KEY = 'duty_schedule_doctors';
const SCHEDULE_KEY = 'duty_schedule_entries';

export function getDoctors(): Doctor[] {
  const data = localStorage.getItem(DOCTORS_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export function saveDoctors(doctors: Doctor[]): void {
  localStorage.setItem(DOCTORS_KEY, JSON.stringify(doctors));
}

export function addDoctor(doctor: Doctor): void {
  const doctors = getDoctors();
  doctors.push(doctor);
  saveDoctors(doctors);
}

export function deleteDoctor(id: string): void {
  const doctors = getDoctors().filter(d => d.id !== id);
  saveDoctors(doctors);
  // Also remove schedule entries for this doctor
  const entries = getScheduleEntries();
  saveScheduleEntries(entries.filter(e => e.doctorId !== id));
}

export function getScheduleEntries(): ScheduleEntry[] {
  const data = localStorage.getItem(SCHEDULE_KEY);
  if (!data) return [];
  return JSON.parse(data);
}

export function saveScheduleEntries(entries: ScheduleEntry[]): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(entries));
}

export function getEntriesForMonth(year: number, month: number): ScheduleEntry[] {
  const key = `${SCHEDULE_KEY}_${year}_${month}`;
  const data = localStorage.getItem(key);
  if (!data) return [];
  return JSON.parse(data);
}

export function saveEntriesForMonth(year: number, month: number, entries: ScheduleEntry[]): void {
  const key = `${SCHEDULE_KEY}_${year}_${month}`;
  localStorage.setItem(key, JSON.stringify(entries));
}
