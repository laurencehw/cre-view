/**
 * NYC Open Data service — queries PLUTO, ACRIS, and DOB datasets
 * via the Socrata Open Data API (SoQL).
 *
 * Data sources:
 *   PLUTO   — building characteristics (address, floors, use, owner, assessed value)
 *   ACRIS   — real property transactions (mortgages, deeds, parties)
 *   DOB     — permits, violations, certificates of occupancy
 */

import logger from './logger';

// ─── Socrata dataset IDs ────────────────────────────────────────────────────

const DATASETS = {
  /** Primary Land Use Tax Lot Output — building/lot characteristics */
  PLUTO: '64uk-42ks',
  /** ACRIS Real Property Master — transactions (mortgages, deeds) */
  ACRIS_MASTER: 'bnx9-e6tj',
  /** ACRIS Real Property Parties — grantor/grantee on transactions */
  ACRIS_PARTIES: '636b-3b5g',
  /** ACRIS Real Property Legals — lot/block/borough linkage */
  ACRIS_LEGALS: '8h5j-fqxa',
  /** DOB Job Application Filings */
  DOB_JOBS: 'ic3t-wcy2',
} as const;

const BASE_URL = 'https://data.cityofnewyork.us/resource';

// Borough codes used by PLUTO
const BOROUGH_CODES: Record<string, string> = {
  manhattan: 'MN',
  brooklyn: 'BK',
  queens: 'QN',
  bronx: 'BX',
  'staten island': 'SI',
};

// Building class → readable use type
const BLDG_CLASS_MAP: Record<string, string> = {
  O: 'Office',
  R: 'Residential',
  D: 'Residential',
  K: 'Mixed-Use',
  S: 'Mixed-Use',
  E: 'Industrial',
  F: 'Industrial',
  H: 'Hotel',
  L: 'Loft',
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlutoBuilding {
  address: string;
  borough: string;
  ownername: string;
  bldgclass: string;
  numfloors: number;
  yearbuilt: number;
  assesstot: number;
  bldgarea: number;
  latitude: number;
  longitude: number;
  lotarea: number;
  primaryUse: string;
  /** Formatted display name */
  displayName: string;
}

export interface AcrisTransaction {
  documentId: string;
  documentType: string;
  recordedDate: string;
  amount: number;
  parties: AcrisParty[];
}

export interface AcrisParty {
  name: string;
  type: string; // 'MORTGAGEE' | 'MORTGAGOR' | 'GRANTOR' | 'GRANTEE' etc
}

export interface PlutoSearchOptions {
  /** Free-text address search */
  address?: string;
  /** Borough filter (manhattan, brooklyn, queens, bronx, staten island) */
  borough?: string;
  /** Minimum number of floors */
  minFloors?: number;
  /** Building class prefix (O = office, R = residential, etc.) */
  buildingClass?: string;
  /** Minimum assessed total value */
  minAssessedValue?: number;
  /** Maximum results (default 50, max 200) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort field */
  orderBy?: 'assesstot' | 'numfloors' | 'yearbuilt' | 'bldgarea';
  /** Sort direction */
  orderDir?: 'ASC' | 'DESC';
}

export interface AcrisSearchOptions {
  /** Borough/Block/Lot to search for */
  borough?: number;
  block?: number;
  lot?: number;
  /** Minimum transaction amount */
  minAmount?: number;
  /** Document type filter (e.g. 'MTGE' for mortgage) */
  documentType?: string;
  /** Date range */
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

// ─── Well-known building names ──────────────────────────────────────────────

const KNOWN_NAMES: Record<string, string> = {
  '185 GREENWICH STREET': 'One World Trade Center',
  '350 5 AVENUE': 'Empire State Building',
  '405 LEXINGTON AVENUE': 'Chrysler Building',
  '432 PARK AVENUE': '432 Park Avenue',
  '270 PARK AVENUE': '270 Park Avenue (JPMorgan HQ)',
  '1111 AVENUE OF THE AMER': 'One Bryant Park (Bank of America Tower)',
  '761 5 AVENUE': 'General Motors Building',
  '427 10 AVENUE': '50 Hudson Yards',
  '30 ROCKEFELLER PLAZA': '30 Rockefeller Plaza (30 Rock)',
  '1221 AVENUE OF THE AMER': '1221 Avenue of the Americas',
  '375 PARK AVENUE': 'Seagram Building',
  '200 PARK AVENUE': 'MetLife Building',
  '601 LEXINGTON AVENUE': 'Citigroup Center',
  '28 LIBERTY STREET': '28 Liberty Street (One Chase Manhattan)',
  '7 WORLD TRADE CENTER': '7 World Trade Center',
  '4 WORLD TRADE CENTER': '4 World Trade Center',
  '3 WORLD TRADE CENTER': '3 World Trade Center',
  '383 MADISON AVENUE': '383 Madison Avenue',
  '388 GREENWICH STREET': 'Citigroup Center (388 Greenwich)',
  '1515 BROADWAY': '1515 Broadway',
  '1585 BROADWAY': 'Morgan Stanley Building',
  '731 LEXINGTON AVENUE': 'Bloomberg Tower',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAddress(raw: string): string {
  let addr = titleCase(raw.trim());
  addr = addr
    .replace(/\bSt\b/g, 'Street')
    .replace(/\bAv\b/g, 'Avenue')
    .replace(/\bAmer\b/g, 'Americas')
    .replace(/\bPl\b/g, 'Plaza');
  return addr;
}

function classifyUse(bldgclass: string): string {
  if (!bldgclass) return 'Office';
  const prefix = bldgclass.charAt(0).toUpperCase();
  return BLDG_CLASS_MAP[prefix] ?? 'Mixed-Use';
}

async function socrataFetch<T>(datasetId: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${BASE_URL}/${datasetId}.json`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // Use app token if configured
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (appToken) {
    headers['X-App-Token'] = appToken;
  }

  logger.info({ url: url.toString().substring(0, 150) }, 'NYC Open Data API request');

  const resp = await fetch(url.toString(), { headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`NYC Open Data API error ${resp.status}: ${body}`);
  }

  return (await resp.json()) as T[];
}

// ─── PLUTO queries ──────────────────────────────────────────────────────────

interface RawPlutoRecord {
  address?: string;
  borough?: string;
  ownername?: string;
  bldgclass?: string;
  numfloors?: string;
  yearbuilt?: string;
  assesstot?: string;
  bldgarea?: string;
  latitude?: string;
  longitude?: string;
  lotarea?: string;
}

function mapPlutoRecord(raw: RawPlutoRecord): PlutoBuilding | null {
  if (!raw.latitude || !raw.longitude || !raw.address) return null;

  const address = raw.address.trim();
  const primaryUse = classifyUse(raw.bldgclass ?? '');

  return {
    address,
    borough: raw.borough ?? '',
    ownername: raw.ownername ?? 'Unknown',
    bldgclass: raw.bldgclass ?? '',
    numfloors: Math.round(parseFloat(raw.numfloors ?? '0')),
    yearbuilt: parseInt(raw.yearbuilt ?? '0') || 0,
    assesstot: parseFloat(raw.assesstot ?? '0'),
    bldgarea: parseFloat(raw.bldgarea ?? '0'),
    latitude: parseFloat(raw.latitude),
    longitude: parseFloat(raw.longitude),
    lotarea: parseFloat(raw.lotarea ?? '0'),
    primaryUse,
    displayName: KNOWN_NAMES[address] ?? `${formatAddress(address)}, New York, NY`,
  };
}

/**
 * Search PLUTO for buildings matching the given criteria.
 */
export async function searchPluto(opts: PlutoSearchOptions): Promise<PlutoBuilding[]> {
  const conditions: string[] = [];
  const fields =
    'address,borough,ownername,bldgclass,numfloors,yearbuilt,assesstot,bldgarea,latitude,longitude,lotarea';

  if (opts.borough) {
    const code = BOROUGH_CODES[opts.borough.toLowerCase()];
    if (code) conditions.push(`borough='${code}'`);
  }

  if (opts.address) {
    conditions.push(`upper(address) LIKE '%${opts.address.toUpperCase().replace(/'/g, "''")}%'`);
  }

  if (opts.minFloors) {
    conditions.push(`numfloors >= ${opts.minFloors}`);
  }

  if (opts.buildingClass) {
    const cls = opts.buildingClass.toUpperCase();
    if (cls.length === 1) {
      // Match all subclasses (e.g. O → O1, O2, O3, O4, O5, O6)
      conditions.push(`bldgclass LIKE '${cls}%'`);
    } else {
      conditions.push(`bldgclass='${cls}'`);
    }
  }

  if (opts.minAssessedValue) {
    conditions.push(`assesstot >= ${opts.minAssessedValue}`);
  }

  // Always require valid coordinates
  conditions.push('latitude IS NOT NULL');
  conditions.push('longitude IS NOT NULL');

  const limit = Math.min(opts.limit ?? 50, 200);
  const orderBy = opts.orderBy ?? 'assesstot';
  const orderDir = opts.orderDir ?? 'DESC';

  const params: Record<string, string> = {
    $select: fields,
    $limit: String(limit),
    $order: `${orderBy} ${orderDir}`,
  };

  if (conditions.length > 0) {
    params.$where = conditions.join(' AND ');
  }

  if (opts.offset) {
    params.$offset = String(opts.offset);
  }

  const rawRecords = await socrataFetch<RawPlutoRecord>(DATASETS.PLUTO, params);
  return rawRecords.map(mapPlutoRecord).filter((b): b is PlutoBuilding => b !== null);
}

// ─── ACRIS queries ──────────────────────────────────────────────────────────

interface RawAcrisMaster {
  document_id?: string;
  doc_type?: string;
  recorded_datetime?: string;
  document_amt?: string;
}

interface RawAcrisParty {
  document_id?: string;
  name?: string;
  party_type?: string;
}

interface RawAcrisLegal {
  document_id?: string;
  borough?: string;
  block?: string;
  lot?: string;
}

/**
 * Search ACRIS for mortgage/deed transactions on a specific lot.
 */
export async function searchAcris(opts: AcrisSearchOptions): Promise<AcrisTransaction[]> {
  if (!opts.borough || !opts.block || !opts.lot) {
    throw new Error('ACRIS search requires borough, block, and lot');
  }

  const limit = Math.min(opts.limit ?? 20, 100);

  // Step 1: Find document IDs for this lot via the legals table
  const legals = await socrataFetch<RawAcrisLegal>(DATASETS.ACRIS_LEGALS, {
    $where: `borough='${opts.borough}' AND block='${opts.block}' AND lot='${opts.lot}'`,
    $select: 'document_id',
    $limit: '500',
  });

  if (legals.length === 0) return [];

  const docIds = [...new Set(legals.map((l) => l.document_id).filter(Boolean))] as string[];
  if (docIds.length === 0) return [];

  // Step 2: Fetch master records for these documents
  const docIdList = docIds.slice(0, 100).map((id) => `'${id}'`).join(',');
  const masterConditions = [`document_id IN (${docIdList})`];

  if (opts.documentType) {
    masterConditions.push(`doc_type='${opts.documentType}'`);
  }
  if (opts.minAmount) {
    masterConditions.push(`document_amt >= ${opts.minAmount}`);
  }
  if (opts.fromDate) {
    masterConditions.push(`recorded_datetime >= '${opts.fromDate}'`);
  }
  if (opts.toDate) {
    masterConditions.push(`recorded_datetime <= '${opts.toDate}'`);
  }

  const masters = await socrataFetch<RawAcrisMaster>(DATASETS.ACRIS_MASTER, {
    $where: masterConditions.join(' AND '),
    $order: 'recorded_datetime DESC',
    $limit: String(limit),
  });

  if (masters.length === 0) return [];

  // Step 3: Fetch parties for these documents
  const masterDocIds = masters.map((m) => m.document_id).filter(Boolean) as string[];
  const partyDocIdList = masterDocIds.map((id) => `'${id}'`).join(',');

  const parties = await socrataFetch<RawAcrisParty>(DATASETS.ACRIS_PARTIES, {
    $where: `document_id IN (${partyDocIdList})`,
    $limit: '500',
  });

  // Group parties by document ID
  const partiesByDoc = new Map<string, AcrisParty[]>();
  for (const p of parties) {
    if (!p.document_id || !p.name) continue;
    const list = partiesByDoc.get(p.document_id) ?? [];
    list.push({ name: p.name, type: p.party_type ?? 'UNKNOWN' });
    partiesByDoc.set(p.document_id, list);
  }

  // Combine
  return masters.map((m) => ({
    documentId: m.document_id ?? '',
    documentType: m.doc_type ?? '',
    recordedDate: m.recorded_datetime ?? '',
    amount: parseFloat(m.document_amt ?? '0'),
    parties: partiesByDoc.get(m.document_id ?? '') ?? [],
  }));
}

// ─── Convenience functions ──────────────────────────────────────────────────

/**
 * Get the top commercial buildings in a borough.
 */
export async function getTopCommercialBuildings(
  borough: string = 'manhattan',
  limit: number = 50,
): Promise<PlutoBuilding[]> {
  return searchPluto({
    borough,
    buildingClass: 'O',
    minFloors: 10,
    limit,
    orderBy: 'assesstot',
    orderDir: 'DESC',
  });
}

/**
 * Search buildings by address keyword.
 */
export async function searchBuildingsByAddress(
  address: string,
  borough?: string,
  limit: number = 20,
): Promise<PlutoBuilding[]> {
  return searchPluto({
    address,
    borough,
    limit,
    orderBy: 'assesstot',
    orderDir: 'DESC',
  });
}
