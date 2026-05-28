/**
 * Parser utility functions
 * Based on spec.md section 7.1: Parsing Engine
 */

import type { ParsedParameter, TxLifecycleEvent } from '../types';

/**
 * Find the longest common suffix between two call stacks
 * Call stacks are compared from the bottom (end) up
 * @param stack1 First call stack string
 * @param stack2 Second call stack string
 * @returns The longest common suffix, or the first stack if second is missing
 */
export function findLongestCommonCallStackSuffix(stack1?: string, stack2?: string): string | undefined {
	if (!stack1 && !stack2) return undefined;
	if (!stack1) return stack2;
	if (!stack2) return stack1;
	
	// Split stacks into lines and reverse to compare from bottom up
	const lines1 = stack1.split('\n').map(l => l.trim()).filter(l => l.length > 0).reverse();
	const lines2 = stack2.split('\n').map(l => l.trim()).filter(l => l.length > 0).reverse();
	
	// Find common suffix
	const commonLines: string[] = [];
	const minLength = Math.min(lines1.length, lines2.length);
	
	for (let i = 0; i < minLength; i++) {
		if (lines1[i] === lines2[i]) {
			commonLines.push(lines1[i]);
		} else {
			break; // Stop at first difference
		}
	}
	
	// If no common lines, return the first stack
	if (commonLines.length === 0) {
		return stack1;
	}
	
	// Reverse back to normal order (top to bottom)
	return commonLines.reverse().join('\n');
}

/**
 * Remove the common suffix from a call stack
 * @param fullStack The complete call stack
 * @param commonSuffix The common suffix to remove
 * @returns The remaining unique portion of the call stack, or undefined if nothing remains
 */
export function removeCommonCallStackSuffix(fullStack?: string, commonSuffix?: string): string | undefined {
	if (!fullStack) return undefined;
	if (!commonSuffix) return fullStack;
	
	const fullLines = fullStack.split('\n').map(l => l.trim()).filter(l => l.length > 0);
	const suffixLines = commonSuffix.split('\n').map(l => l.trim()).filter(l => l.length > 0);
	
	// If the full stack is the same as or shorter than the suffix, return undefined (nothing unique)
	if (fullLines.length <= suffixLines.length) {
		// Check if they're identical
		const allMatch = fullLines.every((line, i) => {
			const suffixIndex = suffixLines.length - fullLines.length + i;
			return suffixIndex >= 0 && line === suffixLines[suffixIndex];
		});
		return allMatch ? undefined : fullStack;
	}
	
	// Remove the suffix lines from the end
	const uniqueLines = fullLines.slice(0, fullLines.length - suffixLines.length);
	
	return uniqueLines.length > 0 ? uniqueLines.join('\n') : undefined;
}

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
	private unmatchedBegins = new Map<string, Array<{
		eventId: number;
		startTime: number;
		lineNumber?: number;
		callStack?: string;
	}>>();

	/**
	 * Register a begin transaction event
	 */
	registerBegin(thread: string, eventId: number, startTime: number, lineNumber?: number, callStack?: string): void {
		if (!this.unmatchedBegins.has(thread)) {
			this.unmatchedBegins.set(thread, []);
		}
		this.unmatchedBegins.get(thread)!.push({ eventId, startTime, lineNumber, callStack });
	}

	/**
	 * Match a commit/rollback with the most recent unmatched begin
	 * Returns the matched begin event or null if no match found
	 */
	matchEnd(thread: string): { eventId: number; startTime: number; lineNumber?: number; callStack?: string } | null {
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
	getUnmatchedBegins(): Map<string, Array<{ eventId: number; startTime: number; lineNumber?: number; callStack?: string }>> {
		return new Map(this.unmatchedBegins);
	}

	/**
	 * Create synthetic spans for all unmatched begins
	 * These represent transactions that started but never ended in the trace file
	 * @param lastLineNumber The last line number in the file
	 * @returns Array of synthetic span events
	 */
	createSyntheticSpansForUnmatchedBegins(lastLineNumber: number): Array<{
		thread: string;
		startTime: number;
		spanStartEventId: number;
		spanStartLine: number;
		spanEndLine: number;
		callStack?: string;
	}> {
		const syntheticSpans: Array<{
			thread: string;
			startTime: number;
			spanStartEventId: number;
			spanStartLine: number;
			spanEndLine: number;
			callStack?: string;
		}> = [];

		for (const [thread, begins] of this.unmatchedBegins.entries()) {
			for (const begin of begins) {
				syntheticSpans.push({
					thread,
					startTime: begin.startTime,
					spanStartEventId: begin.eventId,
					spanStartLine: begin.lineNumber ?? 0,
					spanEndLine: lastLineNumber,
					callStack: begin.callStack
				});
			}
		}

		return syntheticSpans;
	}

	/**
	 * Clear all tracked begins
	 */
	clear(): void {
		this.unmatchedBegins.clear();
	}
}

// Made with Bob
