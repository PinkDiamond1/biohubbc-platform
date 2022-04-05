export class UserObject {
  id: number;
  user_identifier: string;
  record_end_date: string;
  role_ids: number[];
  role_names: string[];

  constructor(obj?: any) {
    this.id = obj?.system_user_id || null;
    this.user_identifier = obj?.user_identifier || null;
    this.record_end_date = obj?.record_end_date || null;
    this.role_ids = (obj?.role_ids?.length && obj.role_ids) || [];
    this.role_names = (obj?.role_names?.length && obj.role_names) || [];
  }
}
