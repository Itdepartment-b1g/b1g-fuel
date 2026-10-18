import type { Request, Response } from "express";
import * as service from "@/server/services/hubs_service";
import { HubError } from "@/server/services/hubs_service";
import { parsePagination, PaginationError } from "@/server/lib/pagination";
import { parse_sort, SortingError } from "@/server/lib/sorting";
import { parse_quick_filters, QuickFilterError } from "@/server/lib/quick-filters";
import { HUB_FILTER_OPTIONS } from "@/utils/hubs-filters";
import { HUB_UUID, HUB_SORT_FIELDS, type CreateHubInput, type UpdateHubInput, type AssignHubInput } from "@/server/schema/hubs_schema";

export async function list_hub(req: Request, res: Response) {
  try {
    if (req.query.company_id !== undefined && (typeof req.query.company_id !== "string" || !HUB_UUID.test(req.query.company_id)))
      throw new HubError("invalid_input", "Provide a valid company ID.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new HubError("invalid_input", "Search must be a string of at most 160 characters.");
    if (req.query.is_active !== undefined && req.query.is_active !== "true" && req.query.is_active !== "false")
      throw new HubError("invalid_input", "is_active must be true or false.");
    res.status(200).json(await service.list_hub(
      parsePagination(req.query), typeof req.query.search === "string" ? req.query.search : "",
      parse_sort(req.query, HUB_SORT_FIELDS), res.locals.access,
      typeof req.query.company_id === "string" ? req.query.company_id.toLowerCase() : undefined,
      req.query.is_active === undefined ? undefined : req.query.is_active === "true",
      parse_quick_filters(req.query.filters, HUB_FILTER_OPTIONS),
    ));
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError || error instanceof QuickFilterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function get_hub_filter_option(_req: Request, res: Response) {
  try {
    res.status(200).json(await service.get_hub_filter_option(res.locals.access));
  } catch (error) {
    console.error("Hub filter options request failed:", error);
    res.status(500).json({ error: "Hub filter choices could not be loaded." });
  }
}

export async function list_by_id_hub(req: Request, res: Response) {
  try {
    if (typeof req.query.id !== "string" || !HUB_UUID.test(req.query.id))
      throw new HubError("invalid_input", "Provide a valid hub ID.");
    res.status(200).json({ hub: await service.list_by_id_hub(req.query.id.toLowerCase(), res.locals.access) });
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function create_hub(req: Request, res: Response) {
  try {
    const input = req.body as CreateHubInput;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["name", "address", "company_id"].includes(key)))
      throw new HubError("invalid_input", "Provide only name, address, and company_id.");
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 160)
      throw new HubError("invalid_input", "Hub name must contain 1 to 160 characters.");
    if (input.address !== undefined && (typeof input.address !== "string" || input.address.trim().length > 160))
      throw new HubError("invalid_input", "Address must be a string of at most 160 characters.");
    if (input.company_id !== undefined && (typeof input.company_id !== "string" || !HUB_UUID.test(input.company_id)))
      throw new HubError("invalid_input", "Provide a valid company ID.");
    res.status(201).json({ hub: await service.create_hub({
      name: input.name.trim(), address: input.address?.trim(), company_id: input.company_id?.toLowerCase(),
    }, res.locals.access) });
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function update_hub(req: Request, res: Response) {
  try {
    const input = req.body as UpdateHubInput;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["id", "name", "address", "is_active"].includes(key)))
      throw new HubError("invalid_input", "Provide only id, name, address, and is_active.");
    if (typeof input.id !== "string" || !HUB_UUID.test(input.id))
      throw new HubError("invalid_input", "Provide a valid hub ID.");
    if (input.name === undefined && input.address === undefined && input.is_active === undefined)
      throw new HubError("invalid_input", "Provide at least one hub field to update.");
    if (input.name !== undefined && (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 160))
      throw new HubError("invalid_input", "Hub name must contain 1 to 160 characters.");
    if (input.address !== undefined && (typeof input.address !== "string" || input.address.trim().length > 160))
      throw new HubError("invalid_input", "Address must be a string of at most 160 characters.");
    if (input.is_active !== undefined && typeof input.is_active !== "boolean")
      throw new HubError("invalid_input", "is_active must be a boolean.");
    res.status(200).json({ hub: await service.update_hub({
      id: input.id.toLowerCase(), name: input.name?.trim(), address: input.address?.trim(), is_active: input.is_active,
    }, res.locals.access) });
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function delete_hub(req: Request, res: Response) {
  try {
    if (typeof req.query.id !== "string" || !HUB_UUID.test(req.query.id))
      throw new HubError("invalid_input", "Provide a valid hub ID.");
    res.status(200).json(await service.delete_hub(req.query.id.toLowerCase(), res.locals.access));
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function get_hub_option(_req: Request, res: Response) {
  try {
    res.status(200).json(await service.get_hub_option(res.locals.access));
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function get_hub_assignment_option(req: Request, res: Response) {
  try {
    if (typeof req.query.location_id !== "string" || !HUB_UUID.test(req.query.location_id))
      throw new HubError("invalid_input", "Provide a valid hub location_id.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new HubError("invalid_input", "Search must be a string of at most 160 characters.");
    res.status(200).json(await service.get_hub_assignment_option(
      req.query.location_id.toLowerCase(), parsePagination(req.query), typeof req.query.search === "string" ? req.query.search : "", res.locals.access,
    ));
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function list_hub_assignment(req: Request, res: Response) {
  try {
    if (typeof req.query.location_id !== "string" || !HUB_UUID.test(req.query.location_id))
      throw new HubError("invalid_input", "Provide a valid hub location_id.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new HubError("invalid_input", "Search must be a string of at most 160 characters.");
    res.status(200).json(await service.list_hub_assignment(req.query.location_id.toLowerCase(), parsePagination(req.query), res.locals.access, typeof req.query.search === "string" ? req.query.search : ""));
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function list_hub_assignment_history(req: Request, res: Response) {
  try {
    if (typeof req.query.location_id !== "string" || !HUB_UUID.test(req.query.location_id))
      throw new HubError("invalid_input", "Provide a valid hub location_id.");
    if (req.query.search !== undefined && (typeof req.query.search !== "string" || req.query.search.length > 160))
      throw new HubError("invalid_input", "Search must be a string of at most 160 characters.");
    res.status(200).json(await service.list_hub_assignment_history(
      req.query.location_id.toLowerCase(), parsePagination(req.query), res.locals.access,
      typeof req.query.search === "string" ? req.query.search : "",
    ));
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Hub assignment history request failed:", error);
    res.status(500).json({ error: "Hub assignment history could not be loaded." });
  }
}

export async function assign_hub(req: Request, res: Response) {
  try {
    const input = req.body as AssignHubInput;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["location_id", "user_company_id"].includes(key)))
      throw new HubError("invalid_input", "Provide only location_id and user_company_id.");
    if (typeof input.location_id !== "string" || !HUB_UUID.test(input.location_id) || typeof input.user_company_id !== "string" || !HUB_UUID.test(input.user_company_id))
      throw new HubError("invalid_input", "Provide valid hub and company membership IDs.");
    res.status(201).json({ assignment: await service.assign_hub({
      location_id: input.location_id.toLowerCase(), user_company_id: input.user_company_id.toLowerCase(),
    }, res.locals.access) });
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

export async function unassign_hub(req: Request, res: Response) {
  try {
    if (typeof req.query.location_id !== "string" || !HUB_UUID.test(req.query.location_id) || typeof req.query.user_company_id !== "string" || !HUB_UUID.test(req.query.user_company_id))
      throw new HubError("invalid_input", "Provide valid hub and company membership IDs.");
    res.status(200).json(await service.unassign_hub({
      location_id: req.query.location_id.toLowerCase(), user_company_id: req.query.user_company_id.toLowerCase(),
    }, res.locals.access));
  } catch (error) {
    if (error instanceof HubError) {
      res.status({ invalid_input: 400, not_found: 404, forbidden: 403, conflict: 409 }[error.code]).json({ error: error.message });
      return;
    }
    if (error instanceof PaginationError || error instanceof SortingError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002") {
        res.status(409).json({ error: "A location with this name already exists in the company." });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({ error: "The company, hub, or company membership is no longer available." });
        return;
      }
      if (error.code === "P2034") {
        res.status(409).json({ error: "The hub changed during this request. Please retry." });
        return;
      }
    }
    console.error("Hub request failed:", error);
    res.status(500).json({ error: "The hub request could not be completed." });
  }
}

