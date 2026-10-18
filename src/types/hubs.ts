import type { CompanyOption } from "./companies";
import type { ApiPaginationMetadata } from "./pagination";

export interface HubSummary {
  id: string;
  company_id: string;
  company: CompanyOption;
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
export interface CreateHubInput { company_id?: string; name: string; address?: string }
export interface UpdateHubInput { id: string; name?: string; address?: string; is_active?: boolean }
export interface HubResponse { hub: HubSummary }
export interface HubOptions { companies: CompanyOption[] }
export interface HubsPage extends ApiPaginationMetadata { hubs: HubSummary[] }
export interface DeactivateHubResponse { id: string; message: string }
export interface HubMember {
  user_company_id: string;
  user: { id: string; name: string; email: string | null };
  roles: { id: string; name: string }[];
}
export interface HubAssignment extends HubMember {
  id: string;
  location_id: string;
  assigned_by: string;
  assigned_by_name: string | null;
  assigned_at: string;
}
export interface HubAssignmentsPage extends ApiPaginationMetadata { assignments: HubAssignment[] }
export interface HubAssignmentOptions extends ApiPaginationMetadata { members: HubMember[] }
export interface AssignHubInput { location_id: string; user_company_id: string }
export interface HubAssignmentResponse { assignment: HubAssignment }
export interface UnassignHubResponse extends AssignHubInput { message: string }
