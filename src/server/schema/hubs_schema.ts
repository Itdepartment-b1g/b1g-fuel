export const HUB_SORT_FIELDS = ["id", "name", "address", "is_active", "created_at", "updated_at"] as const;
export const HUB_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface HubSummary {
  id: string;
  company_id: string;
  company: { id: string; name: string };
  type: "hub";
  name: string;
  address: string;
  is_active: boolean;
  created_by: string | null;
  created_by_name: string | null;
  assigned_user_ids: string[];
  staff_count: number;
  created_at: string;
  updated_at: string;
}

export interface HubAssignment {
  id: string;
  user_company_id: string;
  location_id: string;
  user: { id: string; name: string; email: string | null };
  roles: { id: string; name: string }[];
  assigned_by: string;
  assigned_by_name: string | null;
  assigned_at: string;
}

export interface CreateHubInput {
  company_id?: string;
  name: string;
  address?: string;
}

export interface UpdateHubInput {
  id: string;
  name?: string;
  address?: string;
  is_active?: boolean;
}

export interface AssignHubInput {
  location_id: string;
  user_company_id: string;
}

export interface HubAssignmentHistory {
  id: string;
  location_id: string;
  user_company_id: string;
  user_id: string;
  name: string;
  email: string | null;
  assigned_by: string;
  assigned_by_name: string | null;
  assigned_at: string;
  unassigned_at: string | null;
}
