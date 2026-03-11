import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import BuildingCard from '../BuildingCard';
import type { DetectedBuilding } from '@/lib/types';

const mockBuilding: DetectedBuilding = {
  buildingId: 'bld_001',
  name: 'Empire State Building',
  confidence: 0.95,
  boundingBox: { x: 80, y: 40, width: 60, height: 280 },
};

describe('BuildingCard', () => {
  it('renders building name and confidence', () => {
    render(<BuildingCard building={mockBuilding} />);
    expect(screen.getByText('Empire State Building')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('renders building ID', () => {
    render(<BuildingCard building={mockBuilding} />);
    expect(screen.getByText('ID: bld_001')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<BuildingCard building={mockBuilding} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows green badge for high confidence (>=90%)', () => {
    render(<BuildingCard building={mockBuilding} />);
    const badge = screen.getByText('95%');
    expect(badge.className).toContain('text-green-400');
  });

  it('shows yellow badge for lower confidence (<90%)', () => {
    const lowConfidence: DetectedBuilding = { ...mockBuilding, confidence: 0.85 };
    render(<BuildingCard building={lowConfidence} />);
    const badge = screen.getByText('85%');
    expect(badge.className).toContain('text-yellow-400');
  });

  it('applies selected styles when isSelected is true', () => {
    render(<BuildingCard building={mockBuilding} isSelected={true} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('border-brand-500');
  });
});
