import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageCapture from '../ImageCapture';

// Mock URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

function createMockFile(name = 'skyline.jpg', type = 'image/jpeg') {
  return new File(['dummy'], name, { type });
}

describe('ImageCapture', () => {
  const onImageSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders drop zone with instructions', () => {
    render(<ImageCapture onImageSelected={onImageSelected} />);
    expect(screen.getByText(/drop a skyline photo here/i)).toBeInTheDocument();
    expect(screen.getByText(/JPEG, PNG or WebP/i)).toBeInTheDocument();
  });

  it('calls onImageSelected when a file is selected via input', () => {
    render(<ImageCapture onImageSelected={onImageSelected} />);
    const fileInput = document.querySelector('input[type="file"][accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = createMockFile();
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onImageSelected).toHaveBeenCalledWith(file);
  });

  it('handles drag and drop', () => {
    render(<ImageCapture onImageSelected={onImageSelected} />);
    const dropZone = screen.getByText(/drop a skyline photo here/i).closest('div')!;

    const file = createMockFile();
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });
    expect(onImageSelected).toHaveBeenCalledWith(file);
  });

  it('shows preview after file selection', () => {
    render(<ImageCapture onImageSelected={onImageSelected} />);
    const fileInput = document.querySelector('input[type="file"][accept="image/jpeg,image/png,image/webp"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [createMockFile()] } });
    const preview = screen.getByAltText('Uploaded skyline');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', 'blob:mock-url');
  });

  it('shows loading state', () => {
    render(<ImageCapture onImageSelected={onImageSelected} isLoading={true} />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('disables camera button when loading', () => {
    render(<ImageCapture onImageSelected={onImageSelected} isLoading={true} />);
    const cameraBtn = screen.getByRole('button', { name: /take photo/i });
    expect(cameraBtn).toBeDisabled();
  });
});
