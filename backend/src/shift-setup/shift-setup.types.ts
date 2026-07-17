export type ShiftStatus = 'Active' | 'Inactive';

export interface Shift {
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  allowOvernight: boolean;
  status: ShiftStatus;
  createdAt: string;
  updatedAt: string;
}
