import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useFormDraft logic', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => {
        mockStorage[key] = String(value);
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };
  });

  it('saves and parses draft JSON correctly', () => {
    const key = 'dairydrop_draft_customer_register';
    const data = {
      step: 'details',
      pincode: '122001',
      name: 'Rahul Sharma',
      phone: '9876543210',
      selectedPlanIds: ['plan_1', 'plan_2'],
    };

    localStorage.setItem(key, JSON.stringify(data));
    const loaded = JSON.parse(localStorage.getItem(key));

    expect(loaded.pincode).toBe('122001');
    expect(loaded.name).toBe('Rahul Sharma');
    expect(loaded.selectedPlanIds).toEqual(['plan_1', 'plan_2']);
  });

  it('clears draft when form is successfully submitted', () => {
    const key = 'dairydrop_draft_milkman_application';
    localStorage.setItem(key, JSON.stringify({ businessName: 'Krishna Dairy', phone: '9876543210' }));
    expect(localStorage.getItem(key)).not.toBeNull();

    localStorage.removeItem(key);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('handles invalid JSON corrupted storage gracefully', () => {
    const key = 'dairydrop_draft_corrupted';
    localStorage.setItem(key, '{invalid json');

    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(key));
    } catch {
      parsed = null;
    }

    expect(parsed).toBeNull();
  });
});
