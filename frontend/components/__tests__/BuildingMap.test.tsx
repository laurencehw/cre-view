import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import BuildingMap from '../BuildingMap';
import type { Building } from '@/lib/types';

const mockBuildings: Building[] = [
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
];

describe('BuildingMap', () => {
  beforeEach(() => {
    // Ensure no Mapbox token so we get OSM fallback
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  });

  it('renders OSM fallback iframe when no Mapbox token', () => {
    render(<BuildingMap buildings={mockBuildings} />);
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('title')).toBe('Building locations');
  });

  it('renders building buttons', () => {
    render(<BuildingMap buildings={mockBuildings} />);
    expect(screen.getByText('Empire State Building')).toBeInTheDocument();
    expect(screen.getByText('One World Trade Center')).toBeInTheDocument();
  });

  it('calls onBuildingClick when a building button is clicked', () => {
    const onClick = jest.fn();
    render(<BuildingMap buildings={mockBuildings} onBuildingClick={onClick} />);
    fireEvent.click(screen.getByText('Empire State Building'));
    expect(onClick).toHaveBeenCalledWith(mockBuildings[0]);
  });

  it('applies selected styling to selected building', () => {
    render(
      <BuildingMap
        buildings={mockBuildings}
        selectedBuildingId="bld_001"
      />,
    );
    const empireBtn = screen.getByText('Empire State Building');
    expect(empireBtn.className).toContain('bg-brand-500/20');
    const wtcBtn = screen.getByText('One World Trade Center');
    expect(wtcBtn.className).not.toContain('bg-brand-500/20');
  });

  it('shows Mapbox token hint when not configured', () => {
    render(<BuildingMap buildings={mockBuildings} />);
    expect(screen.getByText(/NEXT_PUBLIC_MAPBOX_TOKEN/)).toBeInTheDocument();
  });
});
