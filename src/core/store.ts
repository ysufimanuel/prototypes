/**
 * Store - State Management Pusat (Observable Pattern)
 * Semua state global dikelola di sini
 */

import type { Member, Family, Group, Event, Attendance, Donation, Volunteer, Assignment, Announcement, User, FinanceCategory, FinanceConfig, Pemasukan, Pengeluaran, ApprovalHistory, Notification, Death, Donor } from '@/types/models';

// =========================================================
// STATE INTERFACES
// =========================================================

export interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  churchId: string | null;
  churchName: string;

  // Data Collections
  members: Member[];
  families: Family[];
  groups: Group[];
  events: Event[];
  attendance: Attendance[];
  donations: Donation[];
  donors: Donor[];
  volunteers: Volunteer[];
  assignments: Assignment[];
  announcements: Announcement[];
  users: User[];
  pemasukan: Pemasukan[];
  pengeluaran: Pengeluaran[];
  financeCategories: FinanceCategory[];
  finance: FinanceConfig;
  approvalHistory: ApprovalHistory[];
  notifications: Notification[];
  deaths: Death[];
  activities: Activity[];

  // UI State
  language: string;
  sidebarOpen: boolean;
  loading: boolean;
  currentPage: string;
  toast: Toast | null;
}

export interface Activity {
  id: string;
  type: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// =========================================================
// INITIAL STATE
// =========================================================

const initialState: AppState = {
  currentUser: null,
  isAuthenticated: false,
  churchId: null,
  churchName: 'Gereja Digital',

  members: [],
  families: [],
  groups: [],
  events: [],
  attendance: [],
  donations: [],
  donors: [],
  volunteers: [],
  assignments: [],
  announcements: [],
  users: [],
  pemasukan: [],
  pengeluaran: [],
  financeCategories: [],
  finance: { saldoAwal: 0, saldoAkhir: 0 },
  approvalHistory: [],
  notifications: [],
  deaths: [],
  activities: [],

  language: localStorage.getItem('cmsLanguage') || 'id',
  sidebarOpen: false,
  loading: false,
  currentPage: 'dashboard',
  toast: null,
};

// =========================================================
// OBSERVER PATTERN
// =========================================================

type Subscriber = (state: AppState) => void;
type Selector<T> = (state: AppState) => T;

class Store {
  private state: AppState;
  private subscribers: Subscriber[] = [];

  constructor() {
    this.state = { ...initialState };
  }

  /** Subscribe ke perubahan state */
  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.push(subscriber);
    // Immediately notify with current state
    subscriber(this.state);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== subscriber);
    };
  }

  /** Subscribe dengan selector untuk hanya menerima bagian tertentu */
  select<T>(selector: Selector<T>, subscriber: (value: T) => void): () => void {
    let previousValue = selector(this.state);
    // Immediately notify
    subscriber(previousValue);

    return this.subscribe(state => {
      const newValue = selector(state);
      if (newValue !== previousValue) {
        previousValue = newValue;
        subscriber(newValue);
      }
    });
  }

  /** Get current state (read-only) */
  getState(): Readonly<AppState> {
    return Object.freeze({ ...this.state });
  }

  /** Get state value by selector */
  get<T>(selector: Selector<T>): T {
    return selector(this.state);
  }

  /** Update partial state */
  set(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  /** Update nested collection */
  setCollection<K extends keyof AppState>(key: K, value: AppState[K]): void {
    this.state = { ...this.state, [key]: value };
    this.notify();
  }

  /** Notify all subscribers */
  private notify(): void {
    const frozenState = Object.freeze({ ...this.state });
    this.subscribers.forEach(sub => {
      try {
        sub(frozenState);
      } catch (e) {
        console.error('[STORE] Subscriber error:', e);
      }
    });
  }

  /** Reset state ke initial */
  reset(): void {
    this.state = { ...initialState };
    this.notify();
  }

  /** Show toast notification */
  showToast(message: string, type: Toast['type'] = 'info'): void {
    this.set({ toast: { message, type } });
    // Auto dismiss after 3 seconds
    setTimeout(() => {
      this.set({ toast: null });
    }, 3000);
  }

  /** Set loading state */
  setLoading(loading: boolean): void {
    this.set({ loading });
  }

  /** Toggle sidebar */
  toggleSidebar(): void {
    this.set({ sidebarOpen: !this.state.sidebarOpen });
  }

  /** Set current page */
  setPage(page: string): void {
    this.set({ currentPage: page });
  }

  /** Set language */
  setLanguage(lang: string): void {
    localStorage.setItem('cmsLanguage', lang);
    this.set({ language: lang });
  }
}

// Singleton instance
export const store = new Store();

// =========================================================
// REACT HOOK
// =========================================================

import { useState, useEffect } from 'react';

/**
 * React hook untuk subscribe ke state
 */
export function useStore(): AppState {
  const [state, setState] = useState<AppState>(() => store.getState());

  useEffect(() => {
    return store.subscribe(newState => {
      setState(newState);
    });
  }, []);

  return state;
}

/**
 * React hook untuk subscribe ke bagian tertentu dari state
 */
export function useStoreSelector<T>(selector: Selector<T>): T {
  const [value, setValue] = useState<T>(() => selector(store.getState()));

  useEffect(() => {
    return store.select(selector, newValue => {
      setValue(newValue);
    });
  }, [selector]);

  return value;
}
