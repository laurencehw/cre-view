import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SkylineOverlay from '../SkylineOverlay';
import type { DetectedBuilding } from '@/lib/types';

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

const mockBuildings: DetectedBuilding[] = [
  {
    buildingId: 'bld_001',
    name: 'Empire State Building',
    confidence: 0.95,
    boundingBox: { x: 80, y: 40, width: 70, height: 250 },
  },
  {
    buildingId: 'bld_002',
    name: 'One World Trade Center',
    confidence: 0.87,
    boundingBox: { x: 200, y: 40, width: 70, height: 250 },
  },
];

function renderAndLoadImage(props: Partial<Parameters<typeof SkylineOverlay>[0]> = {}) {
  const result = render(
    <SkylineOverlay
      imageSrc="/test.jpg"
      buildings={mockBuildings}
      {...props}
    />,
  );
  // Simulate image load to trigger imgSize state update
  const img = screen.getByAltText('Analyzed skyline');
  Object.defineProperty(img, 'naturalWidth', { value: 800 });
  Object.defineProperty(img, 'naturalHeight', { value: 400 });
  Object.defineProperty(img, 'clientWidth', { value: 800 });
  Object.defineProperty(img, 'clientHeight', { value: 400 });
  fireEvent.load(img);
  return result;
}

describe('SkylineOverlay', () => {
  it('renders the skyline image', () => {
    render(
      <SkylineOverlay imageSrc="/test-image.jpg" buildings={[]} />,
    );
    const img = screen.getByAltText('Analyzed skyline');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/test-image.jpg');
  });

  it('renders bounding box buttons for buildings after image load', () => {
    renderAndLoadImage();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
  });

  it('calls onBuildingClick when a building button is clicked', () => {
    const onClick = jest.fn();
    renderAndLoadImage({ onBuildingClick: onClick });
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onClick).toHaveBeenCalledWith(mockBuildings[0]);
  });

  it('applies selected styling to the selected building', () => {
    renderAndLoadImage({ selectedBuildingId: 'bld_001' });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toContain('border-brand-400');
    expect(buttons[1].className).not.toContain('border-brand-400');
  });

  it('shows building name labels', () => {
    renderAndLoadImage();
    expect(screen.getByText('Empire State Building')).toBeInTheDocument();
    expect(screen.getByText('One World Trade Center')).toBeInTheDocument();
  });
});
