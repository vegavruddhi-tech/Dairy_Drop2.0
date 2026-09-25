import { describe, it, expect } from 'vitest';
import { PwaInstallModal } from './PwaInstallModal.jsx';

describe('PWA components', () => {
  it('returns null when modal is closed', () => {
    const tree = PwaInstallModal({ open: false, onClose: () => {} });
    expect(tree).toBeNull();
  });

  it('renders modal when open is true', () => {
    const tree = PwaInstallModal({
      open: true,
      onClose: () => {},
      isIos: true,
      isAndroid: false,
      isDesktop: false,
      hasNativePrompt: false,
    });
    expect(tree).not.toBeNull();
    expect(tree.props.className).toContain('fixed');
  });

  it('renders Android flow when isAndroid is true', () => {
    const tree = PwaInstallModal({
      open: true,
      onClose: () => {},
      isIos: false,
      isAndroid: true,
      isDesktop: false,
      hasNativePrompt: true,
      onNativeInstall: () => {},
    });
    expect(tree).not.toBeNull();
  });
});
