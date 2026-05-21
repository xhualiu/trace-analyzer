/**
 * Svelte stores for application state management
 * Based on spec.md section 7.2: State Management
 */

import { writable, derived } from 'svelte/store';
import type { TraceEvent, TraceFileMetadata } from './types';

// Worker status
export type WorkerStatus = 'idle' | 'parsing' | 'persisting' | 'complete' | 'error';

// Filter state
export const activeThreads = writable<string[]>([]);
export const methodFilter = writable<string>('');
export const minDuration = writable<number>(0);
export const activeSqlModes = writable<string[]>([]);

// SQL statement type filters (SELECT, UPDATE, DELETE, INSERT, etc.)
export const showSqlSelect = writable<boolean>(true);
export const showSqlUpdate = writable<boolean>(true);
export const showSqlDelete = writable<boolean>(true);
export const showSqlInsert = writable<boolean>(true);
export const showSqlOther = writable<boolean>(true);

// Transaction type filters
export const showTxSpans = writable<boolean>(true);
export const showTxBegin = writable<boolean>(true);
export const showTxCommit = writable<boolean>(true);
export const showTxRollback = writable<boolean>(true);
export const showSqlEvents = writable<boolean>(true);

// UI state
export const selectedEvent = writable<TraceEvent | null>(null);
export const workerProgress = writable<number>(0);
export const workerStatus = writable<WorkerStatus>('idle');
export const uiError = writable<string | null>(null);
export const traceMetadata = writable<TraceFileMetadata | null>(null);

// Panel visibility state
export const showSidebar = writable<boolean>(true);
export const showDetailsPanel = writable<boolean>(true);

// Enhanced progress tracking for large files
export const parsingRate = writable<number>(0); // events per second
export const estimatedTimeRemaining = writable<number | null>(null); // seconds
export const eventsParsed = writable<number>(0);

// Available threads (derived from data)
export const availableThreads = writable<string[]>([]);

// Available SQL modes (derived from data)
export const availableSqlModes = writable<string[]>([]);

// Database stats
export const dbStats = writable<{ eventCount: number; metadata: TraceFileMetadata | null }>({
	eventCount: 0,
	metadata: null
});

/**
 * Reset all filters to default
 */
export function resetFilters(): void {
	activeThreads.set([]);
	methodFilter.set('');
	minDuration.set(0);
	activeSqlModes.set([]);
	showSqlSelect.set(true);
	showSqlUpdate.set(true);
	showSqlDelete.set(true);
	showSqlInsert.set(true);
	showSqlOther.set(true);
	showTxSpans.set(true);
	showTxBegin.set(true);
	showTxCommit.set(true);
	showTxRollback.set(true);
	showSqlEvents.set(true);
}

/**
 * Reset all state (for new file load)
 */
export function resetAllState(): void {
	resetFilters();
	selectedEvent.set(null);
	workerProgress.set(0);
	workerStatus.set('idle');
	uiError.set(null);
	traceMetadata.set(null);
	parsingRate.set(0);
	estimatedTimeRemaining.set(null);
	eventsParsed.set(0);
	availableThreads.set([]);
	availableSqlModes.set([]);
	dbStats.set({ eventCount: 0, metadata: null });
}

/**
 * Set error state
 */
export function setError(error: string): void {
	uiError.set(error);
	workerStatus.set('error');
}

/**
 * Clear error state
 */
export function clearError(): void {
	uiError.set(null);
}

// Made with Bob
