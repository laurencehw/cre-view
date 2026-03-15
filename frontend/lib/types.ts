// Shared TypeScript types used across frontend components

export interface DetectedBuilding {
  buildingId: string;
  name: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

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
  ownership: number; // 0–1
  amount: number;    // USD
}

export interface DebtTranche {
  amount: number;
  lender: string;
  interestRate: number;
  maturityDate: string;
}

export interface AcrisTransaction {
  documentId: string;
  documentType: string;
  recordedDate: string;
  amount: number;
  parties: { name: string; role: string }[];
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
