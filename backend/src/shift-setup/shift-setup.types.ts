export type ShiftStatus = 'Active' | 'Inactive';

export interface Shift {
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  status: ShiftStatus;
  createdAt: string;
  updatedAt: string;
}
