/**
 * Parser utility functions
 * Based on spec.md section 7.1: Parsing Engine
 */

import type { ParsedParameter, TxLifecycleEvent } from '../types';

/**
 * Parse Java Date.toString() format to epoch milliseconds
 * Format: "Wed Apr 01 20:43:31 GMT 2026"
 * Returns milliseconds rounded to the second
 */
export function parseJavaDateString(dateStr: string): number | null {
	try {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) {
			return null;
		}
		// Round to the second (remove milliseconds)
		return Math.floor(date.getTime() / 1000) * 1000;
	} catch {
		return null;
	}
}

/**
 * Parse parameter CDATA content
 * Format: "Type: [value]"
 * Example: "Int: [2147483647]" or "String: [Mauer.Sydney@mayo.edu]"
 */
export function parseParameter(index: number, raw: string): ParsedParameter {
	const result: ParsedParameter = {
		index,
		raw: raw.trim()
	};

	// Try to parse "Type: [value]" pattern
	const match = result.raw.match(/^([^:]+):\s*\[(.+)\]$/);
	if (match) {
		result.type = match[1].trim();
		result.value = match[2].trim();
	}

	return result;
}

/**
	* Normalize Team Server transaction event names to the internal lifecycle enum
	*/
export function normalizeTxLifecycleEvent(event?: string): TxLifecycleEvent | null {
	if (event === 'beginTransaction') return 'begin';
	if (event === 'commitTransaction') return 'commit';
	if (event === 'rollbackTransaction') return 'rollback';
	return null;
}

/**
 * Synthetic millisecond offset calculator
 * Maintains per-thread, per-second offset to prevent visual overlap
 * Based on spec.md section 7.1: Synthetic Millisecond Offset Algorithm
 */
export class SyntheticOffsetCalculator {
	private offsetMap = new Map<string, number>();

	/**
	 * Get synthetic start time for an SQL event
	 * @param thread Thread name
	 * @param epochSecondMs Epoch time in milliseconds (already rounded to second)
	 * @param executionTimeMs Execution time in milliseconds
	 * @returns Synthetic start time in milliseconds
	 */
	getSyntheticStartTime(thread: string, epochSecondMs: number, executionTimeMs: number): number {
		const key = `${thread}-${epochSecondMs}`;
		const currentOffset = this.offsetMap.get(key) ?? 0;
		const syntheticStartTime = epochSecondMs + currentOffset;
		
		// Update offset for next event in same thread/second
		this.offsetMap.set(key, currentOffset + Math.max(0, executionTimeMs));
		
		return syntheticStartTime;
	}

	/**
	 * Clear all offsets (useful for testing or restarting)
	 */
	clear(): void {
		this.offsetMap.clear();
	}
}

/**
 * Transaction span matcher
 * Tracks unmatched begin events per thread to match with commit/rollback
 */
export class TransactionSpanMatcher {
	private unmatchedBegins = new Map<string, Array<{ eventId: number; startTime: number }>>();

	/**
	 * Register a begin transaction event
	 */
	registerBegin(thread: string, eventId: number, startTime: number): void {
		if (!this.unmatchedBegins.has(thread)) {
			this.unmatchedBegins.set(thread, []);
		}
		this.unmatchedBegins.get(thread)!.push({ eventId, startTime });
	}

	/**
	 * Match a commit/rollback with the most recent unmatched begin
	 * Returns the matched begin event or null if no match found
	 */
	matchEnd(thread: string): { eventId: number; startTime: number } | null {
		const begins = this.unmatchedBegins.get(thread);
		if (!begins || begins.length === 0) {
			return null;
		}
		// Pop the most recent unmatched begin
		return begins.pop()!;
	}

	/**
	 * Get all unmatched begins (for diagnostics)
	 */
	getUnmatchedBegins(): Map<string, Array<{ eventId: number; startTime: number }>> {
		return new Map(this.unmatchedBegins);
	}

	/**
	 * Clear all tracked begins
	 */
	clear(): void {
		this.unmatchedBegins.clear();
	}
}

// Made with Bob
