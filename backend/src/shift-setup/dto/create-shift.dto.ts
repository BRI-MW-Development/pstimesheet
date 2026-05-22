import { ShiftStatus } from '../shift-setup.types';

export interface CreateShiftDto {
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  status: ShiftStatus;
}
