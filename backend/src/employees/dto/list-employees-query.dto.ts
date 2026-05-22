export interface ListEmployeesQueryDto {
  regionIds?: string;
  deptFilter?: string; // 'prod-inst' → only Production & Installation departments
}
