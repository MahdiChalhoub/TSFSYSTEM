import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePermissions } from '../usePermissions';

// Mock fetch
global.fetch = vi.fn();

describe('usePermissions Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('initializes with loading state', () => {
    const { result } = renderHook(() => usePermissions());

    expect(result.current.loading).toBe(true);
    expect(result.current.permissions).toEqual([]);
    expect(result.current.role).toBe(null);
    expect(result.current.isAdmin).toBe(false);
  });

  it('fetches permissions successfully', async () => {
    const mockResponse = {
      permissions: ['crm.view_contact', 'crm.create_contact'],
      role: 'sales_manager',
      is_superuser: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.permissions).toEqual(['crm.view_contact', 'crm.create_contact']);
    expect(result.current.role).toBe('sales_manager');
    expect(result.current.isAdmin).toBe(false);
  });

  it('handles admin users correctly', async () => {
    const mockResponse = {
      permissions: [],
      role: 'admin',
      is_superuser: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
    });

    expect(result.current.isAdmin).toBe(true);
  });

  it('can() returns true for granted permission', async () => {
    const mockResponse = {
      permissions: ['crm.view_contact', 'crm.create_contact'],
      role: 'user',
      is_superuser: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.can('crm.view_contact')).toBe(true);
    expect(result.current.can('crm.delete_contact')).toBe(false);
  });

  it('can() returns true for admin users regardless of permission', async () => {
    const mockResponse = {
      permissions: [],
      role: 'admin',
      is_superuser: true,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
    });

    expect(result.current.can('any.permission.code')).toBe(true);
  });

  it('canAny() returns true if user has any of the permissions', async () => {
    const mockResponse = {
      permissions: ['crm.view_contact'],
      role: 'user',
      is_superuser: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.canAny(['crm.view_contact', 'crm.create_contact'])).toBe(true);
    expect(result.current.canAny(['crm.edit_contact', 'crm.delete_contact'])).toBe(false);
  });

  it('canAll() returns true only if user has all permissions', async () => {
    const mockResponse = {
      permissions: ['crm.view_contact', 'crm.create_contact'],
      role: 'user',
      is_superuser: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.canAll(['crm.view_contact', 'crm.create_contact'])).toBe(true);
    expect(result.current.canAll(['crm.view_contact', 'crm.delete_contact'])).toBe(false);
  });

  it('handles fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.permissions).toEqual([]);
    expect(result.current.isAdmin).toBe(false);
  });

  it('caches permissions in sessionStorage', async () => {
    const mockResponse = {
      permissions: ['crm.view_contact'],
      role: 'user',
      is_superuser: false,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const cached = sessionStorage.getItem('tsf_permissions_cache');
    expect(cached).toBeTruthy();
    if (cached) {
      const parsed = JSON.parse(cached);
      expect(parsed.state.permissions).toEqual(['crm.view_contact']);
    }
  });

  it('invalidate() clears cache', async () => {
    const mockResponse = {
      permissions: ['crm.view_contact'],
      role: 'user',
      is_superuser: false,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    result.current.invalidate();

    expect(sessionStorage.getItem('tsf_permissions_cache')).toBeNull();
  });
});
