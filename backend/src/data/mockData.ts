// Mock building dataset for MVP / testing
// In production this would be backed by a PostgreSQL database

export interface Building {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  heightFt: number;
  floors: number;
  completionYear: number;
  primaryUse: string;
  owner: string;
  imageUrl?: string;
}

export interface CapTableEntry {
  investor: string;
  ownership: number;
  amount: number;
}

export interface DebtTranche {
  amount: number;
  lender: string;
  interestRate: number;
  maturityDate: string;
}

export interface BuildingFinancials {
  buildingId: string;
  asOfDate: string;
  dataSource?: 'SEC Filing' | 'NYC PLUTO' | 'Market Estimate';
  valuation: {
    estimatedValue: number;
    currency: string;
    capRate: number;
    noi: number;
  };
  debt: {
    totalDebt: number;
    seniorLoan: DebtTranche;
    mezz?: DebtTranche;
  };
  equity: {
    totalEquity: number;
    capTable: CapTableEntry[];
  };
}

export const MOCK_BUILDINGS: Building[] = [
  {
    id: 'bld_001',
    name: 'Empire State Building',
    address: '350 Fifth Avenue, New York, NY 10118',
    latitude: 40.748817,
    longitude: -73.985428,
    heightFt: 1454,
    floors: 102,
    completionYear: 1931,
    primaryUse: 'Mixed-Use',
    owner: 'Empire State Realty Trust',
  },
  {
    id: 'bld_002',
    name: 'One World Trade Center',
    address: '285 Fulton St, New York, NY 10007',
    latitude: 40.712743,
    longitude: -74.013382,
    heightFt: 1776,
    floors: 104,
    completionYear: 2014,
    primaryUse: 'Office',
    owner: 'Port Authority of NY & NJ',
  },
  {
    id: 'bld_003',
    name: 'Chrysler Building',
    address: '405 Lexington Avenue, New York, NY 10174',
    latitude: 40.751652,
    longitude: -73.975311,
    heightFt: 1046,
    floors: 77,
    completionYear: 1930,
    primaryUse: 'Office',
    owner: 'RFR Holding',
  },
  {
    id: 'bld_004',
    name: '432 Park Avenue',
    address: '432 Park Avenue, New York, NY 10022',
    latitude: 40.761587,
    longitude: -73.971639,
    heightFt: 1396,
    floors: 96,
    completionYear: 2015,
    primaryUse: 'Residential',
    owner: 'CIM Group / Macklowe Properties',
  },
  {
    id: 'bld_005',
    name: 'Willis Tower',
    address: '233 S Wacker Dr, Chicago, IL 60606',
    latitude: 41.878872,
    longitude: -87.635908,
    heightFt: 1451,
    floors: 108,
    completionYear: 1973,
    primaryUse: 'Office',
    owner: 'Blackstone Real Estate Partners',
  },
];

export const MOCK_FINANCIALS: BuildingFinancials[] = [
  {
    buildingId: 'bld_001',
    asOfDate: '2024-01-01',
    valuation: {
      estimatedValue: 2_100_000_000,
      currency: 'USD',
      capRate: 0.045,
      noi: 94_500_000,
    },
    debt: {
      totalDebt: 1_200_000_000,
      seniorLoan: {
        amount: 900_000_000,
        lender: 'Goldman Sachs Mortgage',
        interestRate: 0.062,
        maturityDate: '2028-06-01',
      },
      mezz: {
        amount: 300_000_000,
        lender: 'Blackstone Credit',
        interestRate: 0.095,
        maturityDate: '2026-12-01',
      },
    },
    equity: {
      totalEquity: 900_000_000,
      capTable: [
        { investor: 'Empire State Realty Trust', ownership: 0.55, amount: 495_000_000 },
        { investor: 'Sovereign Wealth Fund A', ownership: 0.30, amount: 270_000_000 },
        { investor: 'Family Office B', ownership: 0.15, amount: 135_000_000 },
      ],
    },
  },
  {
    buildingId: 'bld_002',
    asOfDate: '2024-01-01',
    valuation: {
      estimatedValue: 3_500_000_000,
      currency: 'USD',
      capRate: 0.04,
      noi: 140_000_000,
    },
    debt: {
      totalDebt: 1_800_000_000,
      seniorLoan: {
        amount: 1_800_000_000,
        lender: 'NY State Urban Development Corp',
        interestRate: 0.055,
        maturityDate: '2034-01-01',
      },
    },
    equity: {
      totalEquity: 1_700_000_000,
      capTable: [
        { investor: 'Port Authority of NY & NJ', ownership: 1.0, amount: 1_700_000_000 },
      ],
    },
  },
  {
    buildingId: 'bld_003',
    asOfDate: '2024-01-01',
    valuation: {
      estimatedValue: 800_000_000,
      currency: 'USD',
      capRate: 0.05,
      noi: 40_000_000,
    },
    debt: {
      totalDebt: 500_000_000,
      seniorLoan: {
        amount: 500_000_000,
        lender: 'Deutsche Bank AG',
        interestRate: 0.07,
        maturityDate: '2027-03-15',
      },
    },
    equity: {
      totalEquity: 300_000_000,
      capTable: [
        { investor: 'RFR Holding LLC', ownership: 0.80, amount: 240_000_000 },
        { investor: 'Abu Dhabi Investment Authority', ownership: 0.20, amount: 60_000_000 },
      ],
    },
  },
  {
    buildingId: 'bld_004',
    asOfDate: '2024-01-01',
    valuation: {
      estimatedValue: 1_250_000_000,
      currency: 'USD',
      capRate: 0.032,
      noi: 40_000_000,
    },
    debt: {
      totalDebt: 700_000_000,
      seniorLoan: {
        amount: 700_000_000,
        lender: 'Wells Fargo Bank',
        interestRate: 0.068,
        maturityDate: '2029-09-01',
      },
    },
    equity: {
      totalEquity: 550_000_000,
      capTable: [
        { investor: 'CIM Group', ownership: 0.60, amount: 330_000_000 },
        { investor: 'Macklowe Properties', ownership: 0.40, amount: 220_000_000 },
      ],
    },
  },
  {
    buildingId: 'bld_005',
    asOfDate: '2024-01-01',
    valuation: {
      estimatedValue: 1_300_000_000,
      currency: 'USD',
      capRate: 0.06,
      noi: 78_000_000,
    },
    debt: {
      totalDebt: 800_000_000,
      seniorLoan: {
        amount: 600_000_000,
        lender: 'JPMorgan Chase Bank',
        interestRate: 0.058,
        maturityDate: '2030-11-01',
      },
      mezz: {
        amount: 200_000_000,
        lender: 'Apollo Global Management',
        interestRate: 0.10,
        maturityDate: '2028-11-01',
      },
    },
    equity: {
      totalEquity: 500_000_000,
      capTable: [
        { investor: 'Blackstone Real Estate Partners', ownership: 0.75, amount: 375_000_000 },
        { investor: 'Canada Pension Plan', ownership: 0.25, amount: 125_000_000 },
      ],
    },
  },
];

export function findBuildingById(id: string): Building | undefined {
  return MOCK_BUILDINGS.find((b) => b.id === id);
}

export function findFinancialsByBuildingId(buildingId: string): BuildingFinancials | undefined {
  return MOCK_FINANCIALS.find((f) => f.buildingId === buildingId);
}
