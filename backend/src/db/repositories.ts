// Repository layer that abstracts data access from route handlers.
// Currently proxies to mock data helpers; switch to real SQL queries
// when connected to PostgreSQL.

import {
  Building,
  BuildingFinancials,
  MOCK_BUILDINGS,
  findBuildingById as mockFindBuilding,
  findFinancialsByBuildingId as mockFindFinancials,
} from '../data/mockData';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listBuildings(opts: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResult<Building>> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const search = opts.search?.toLowerCase();

  // When connected to a real DB, this would be:
  //   SELECT * FROM buildings WHERE LOWER(name) LIKE $1 OR LOWER(address) LIKE $1
  //   ORDER BY name LIMIT $2 OFFSET $3

  let filtered = MOCK_BUILDINGS;
  if (search) {
    filtered = filtered.filter(
      (b) =>
        b.name.toLowerCase().includes(search) ||
        b.address.toLowerCase().includes(search),
    );
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getBuildingById(id: string): Promise<Building | null> {
  // Real DB: SELECT * FROM buildings WHERE id = $1
  return mockFindBuilding(id) ?? null;
}

export async function getFinancialsByBuildingId(buildingId: string): Promise<BuildingFinancials | null> {
  // Real DB: JOIN financials + cap_table_entries + transform to BuildingFinancials shape
  return mockFindFinancials(buildingId) ?? null;
}
