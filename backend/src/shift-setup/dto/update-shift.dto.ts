import { ShiftStatus } from '../shift-setup.types';

export interface UpdateShiftDto {
  shiftName?: string;
  startTime?: string;
  endTime?: string;
  graceMinutes?: number;
  allowOvernight?: boolean;
  status?: ShiftStatus;
}
