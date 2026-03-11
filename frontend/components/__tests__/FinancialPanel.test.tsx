import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import FinancialPanel from '../FinancialPanel';
import type { DetectedBuilding, Building, BuildingFinancials } from '@/lib/types';

const mockBuilding: DetectedBuilding = {
  buildingId: 'bld_001',
  name: 'Empire State Building',
  confidence: 0.95,
};

const mockDetails: Building = {
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
};

const mockFinancials: BuildingFinancials = {
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
};

describe('FinancialPanel', () => {
  it('renders building name and as-of date', () => {
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} />);
    expect(screen.getByText('Empire State Building')).toBeInTheDocument();
    expect(screen.getByText('As of 2024-01-01')).toBeInTheDocument();
  });

  it('renders KPI stat cards', () => {
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} />);
    expect(screen.getByText('Valuation')).toBeInTheDocument();
    expect(screen.getByText('Cap Rate')).toBeInTheDocument();
    expect(screen.getByText('NOI')).toBeInTheDocument();
    expect(screen.getByText('LTV')).toBeInTheDocument();
    expect(screen.getByText('DSCR')).toBeInTheDocument();
    expect(screen.getByText('Wtd Avg Rate')).toBeInTheDocument();
  });

  it('renders valuation value', () => {
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} />);
    expect(screen.getByText('$2.1B')).toBeInTheDocument();
  });

  it('renders debt structure table', () => {
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} />);
    expect(screen.getByText('Senior Loan')).toBeInTheDocument();
    expect(screen.getByText('Mezzanine')).toBeInTheDocument();
    expect(screen.getByText('Total Debt')).toBeInTheDocument();
    expect(screen.getByText('Goldman Sachs Mortgage')).toBeInTheDocument();
  });

  it('renders cap table with investors', () => {
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} />);
    expect(screen.getByText('Empire State Realty Trust')).toBeInTheDocument();
    expect(screen.getByText('Sovereign Wealth Fund A')).toBeInTheDocument();
    expect(screen.getByText('Family Office B')).toBeInTheDocument();
  });

  it('renders building details when provided', () => {
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} details={mockDetails} />);
    expect(screen.getByText('350 Fifth Avenue, New York, NY 10118')).toBeInTheDocument();
    expect(screen.getByText('102 floors')).toBeInTheDocument();
    expect(screen.getByText('Mixed-Use')).toBeInTheDocument();
    expect(screen.getByText('Built 1931')).toBeInTheDocument();
  });

  it('renders without building details gracefully', () => {
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} details={null} />);
    expect(screen.getByText('Empire State Building')).toBeInTheDocument();
    expect(screen.queryByText('102 floors')).not.toBeInTheDocument();
  });

  it('calculates DSCR correctly', () => {
    // NOI = 94.5M, Debt service = (900M * 0.062) + (300M * 0.095) = 55.8M + 28.5M = 84.3M
    // DSCR = 94.5 / 84.3 = ~1.12x
    render(<FinancialPanel building={mockBuilding} financials={mockFinancials} />);
    expect(screen.getByText('1.12x')).toBeInTheDocument();
  });

  it('handles financials without mezzanine debt', () => {
    const noMezz: BuildingFinancials = {
      ...mockFinancials,
      debt: {
        totalDebt: 900_000_000,
        seniorLoan: mockFinancials.debt.seniorLoan,
      },
    };
    render(<FinancialPanel building={mockBuilding} financials={noMezz} />);
    expect(screen.getByText('Senior Loan')).toBeInTheDocument();
    expect(screen.queryByText('Mezzanine')).not.toBeInTheDocument();
  });
});
