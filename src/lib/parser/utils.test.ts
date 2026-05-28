/**
 * Unit tests for parser utilities
 * Following TDD approach from spec.md section 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { TxLifecycleEvent } from '../types';
import {
	parseJavaDateString,
	parseParameter,
	SyntheticOffsetCalculator,
	TransactionSpanMatcher
} from './utils';

describe('parseJavaDateString', () => {
	it('should parse valid Java date string to epoch milliseconds', () => {
		const dateStr = 'Wed Apr 01 20:43:31 GMT 2026';
		const result = parseJavaDateString(dateStr);
		
		expect(result).not.toBeNull();
		expect(result).toBeGreaterThan(0);
		
		// Should be rounded to the second (no milliseconds)
		expect(result! % 1000).toBe(0);
	});

	it('should return null for invalid date string', () => {
		const result = parseJavaDateString('invalid date');
		expect(result).toBeNull();
	});

	it('should round to the second', () => {
		const dateStr = 'Wed Apr 01 20:43:31 GMT 2026';
		const result = parseJavaDateString(dateStr);
		
		// Verify it's a whole second
		expect(result! % 1000).toBe(0);
	});
});

describe('parseParameter', () => {
	it('should parse Int parameter correctly', () => {
		const result = parseParameter(1, 'Int: [2147483647]');
		
		expect(result.index).toBe(1);
		expect(result.raw).toBe('Int: [2147483647]');
		expect(result.type).toBe('Int');
		expect(result.value).toBe('2147483647');
	});

	it('should parse String parameter correctly', () => {
		const result = parseParameter(2, 'String: [Mauer.Sydney@mayo.edu]');
		
		expect(result.index).toBe(2);
		expect(result.raw).toBe('String: [Mauer.Sydney@mayo.edu]');
		expect(result.type).toBe('String');
		expect(result.value).toBe('Mauer.Sydney@mayo.edu');
	});

	it('should handle malformed parameter gracefully', () => {
		const result = parseParameter(1, 'malformed data');
		
		expect(result.index).toBe(1);
		expect(result.raw).toBe('malformed data');
		expect(result.type).toBeUndefined();
		expect(result.value).toBeUndefined();
	});

	it('should trim whitespace', () => {
		const result = parseParameter(1, '  Int: [123]  ');
		
		expect(result.raw).toBe('Int: [123]');
		expect(result.type).toBe('Int');
		expect(result.value).toBe('123');
	});
});

describe('SyntheticOffsetCalculator', () => {
	let calculator: SyntheticOffsetCalculator;

	beforeEach(() => {
		calculator = new SyntheticOffsetCalculator();
	});

	it('should return base time for first event in thread/second', () => {
		const thread = 'thread-1';
		const epochSecond = 1000000000000; // Some epoch time
		const executionTime = 50;

		const result = calculator.getSyntheticStartTime(thread, epochSecond, executionTime);
		
		expect(result).toBe(epochSecond);
	});

	it('should apply offset for subsequent events in same thread/second', () => {
		const thread = 'thread-1';
		const epochSecond = 1000000000000;

		const first = calculator.getSyntheticStartTime(thread, epochSecond, 50);
		const second = calculator.getSyntheticStartTime(thread, epochSecond, 30);
		
		expect(first).toBe(epochSecond);
		expect(second).toBe(epochSecond + 50);
	});

	it('should maintain independent offsets per thread', () => {
		const epochSecond = 1000000000000;

		const thread1First = calculator.getSyntheticStartTime('thread-1', epochSecond, 50);
		const thread2First = calculator.getSyntheticStartTime('thread-2', epochSecond, 30);
		
		expect(thread1First).toBe(epochSecond);
		expect(thread2First).toBe(epochSecond); // Independent offset
	});

	it('should reset offset for new second', () => {
		const thread = 'thread-1';
		const epochSecond1 = 1000000000000;
		const epochSecond2 = 1000000001000; // Next second

		calculator.getSyntheticStartTime(thread, epochSecond1, 50);
		const result = calculator.getSyntheticStartTime(thread, epochSecond2, 30);
		
		expect(result).toBe(epochSecond2); // Reset to base time
	});

	it('should accumulate offsets correctly', () => {
		const thread = 'thread-1';
		const epochSecond = 1000000000000;

		const first = calculator.getSyntheticStartTime(thread, epochSecond, 10);
		const second = calculator.getSyntheticStartTime(thread, epochSecond, 20);
		const third = calculator.getSyntheticStartTime(thread, epochSecond, 15);
		
		expect(first).toBe(epochSecond);
		expect(second).toBe(epochSecond + 10);
		expect(third).toBe(epochSecond + 30);
	});

	it('should handle zero execution time', () => {
		const thread = 'thread-1';
		const epochSecond = 1000000000000;

		const first = calculator.getSyntheticStartTime(thread, epochSecond, 0);
		const second = calculator.getSyntheticStartTime(thread, epochSecond, 10);
		
		expect(first).toBe(epochSecond);
		expect(second).toBe(epochSecond); // No offset added for zero duration
	});

	it('should clear all offsets', () => {
		const thread = 'thread-1';
		const epochSecond = 1000000000000;

		calculator.getSyntheticStartTime(thread, epochSecond, 50);
		calculator.clear();
		
		const result = calculator.getSyntheticStartTime(thread, epochSecond, 30);
		expect(result).toBe(epochSecond); // Reset after clear
	});
});

describe('TransactionSpanMatcher', () => {
	let matcher: TransactionSpanMatcher;

	beforeEach(() => {
		matcher = new TransactionSpanMatcher();
	});

	it('should register begin transaction', () => {
		matcher.registerBegin('thread-1', 1, 1000);
		
		const unmatched = matcher.getUnmatchedBegins();
		expect(unmatched.get('thread-1')).toHaveLength(1);
	});

	it('should match commit with most recent begin', () => {
		matcher.registerBegin('thread-1', 1, 1000);
		
		const matched = matcher.matchEnd('thread-1');
		
		expect(matched).not.toBeNull();
		expect(matched!.eventId).toBe(1);
		expect(matched!.startTime).toBe(1000);
	});

	it('should return null when no begin to match', () => {
		const matched = matcher.matchEnd('thread-1');
		expect(matched).toBeNull();
	});

	it('should match LIFO (last in, first out)', () => {
		matcher.registerBegin('thread-1', 1, 1000);
		matcher.registerBegin('thread-1', 2, 2000);
		
		const first = matcher.matchEnd('thread-1');
		const second = matcher.matchEnd('thread-1');
		
		expect(first!.eventId).toBe(2); // Most recent
		expect(second!.eventId).toBe(1);
	});

	it('should maintain independent stacks per thread', () => {
		matcher.registerBegin('thread-1', 1, 1000);
		matcher.registerBegin('thread-2', 2, 2000);
		
		const thread1Match = matcher.matchEnd('thread-1');
		const thread2Match = matcher.matchEnd('thread-2');
		
		expect(thread1Match!.eventId).toBe(1);
		expect(thread2Match!.eventId).toBe(2);
	});

	it('should handle nested transactions', () => {
		matcher.registerBegin('thread-1', 1, 1000);
		matcher.registerBegin('thread-1', 2, 1500);
		matcher.registerBegin('thread-1', 3, 2000);
		
		const first = matcher.matchEnd('thread-1');
		const second = matcher.matchEnd('thread-1');
		const third = matcher.matchEnd('thread-1');
		
		expect(first!.eventId).toBe(3);
		expect(second!.eventId).toBe(2);
		expect(third!.eventId).toBe(1);
	});

	it('should clear all tracked begins', () => {
		matcher.registerBegin('thread-1', 1, 1000);
		matcher.clear();
		
		const matched = matcher.matchEnd('thread-1');
		expect(matched).toBeNull();
	});

	it('should track line numbers with begin events', () => {
		matcher.registerBegin('thread-1', 1, 1000, 100);
		
		const matched = matcher.matchEnd('thread-1');
		
		expect(matched).not.toBeNull();
		expect(matched!.lineNumber).toBe(100);
	});

	it('should return line number when matching', () => {
		matcher.registerBegin('thread-1', 1, 1000, 8663);
		matcher.registerBegin('thread-1', 2, 2000, 8700);
		
		const first = matcher.matchEnd('thread-1');
		const second = matcher.matchEnd('thread-1');
		
		expect(first!.lineNumber).toBe(8700); // Most recent
		expect(second!.lineNumber).toBe(8663);
	});

	it('should handle missing line numbers gracefully', () => {
		matcher.registerBegin('thread-1', 1, 1000); // No line number
		
		const matched = matcher.matchEnd('thread-1');
		
		expect(matched).not.toBeNull();
		expect(matched!.lineNumber).toBeUndefined();
	});

	it('should track line numbers independently per thread', () => {
		matcher.registerBegin('thread-1', 1, 1000, 100);
		matcher.registerBegin('thread-2', 2, 2000, 200);
		
		const thread1Match = matcher.matchEnd('thread-1');
		const thread2Match = matcher.matchEnd('thread-2');
		
		expect(thread1Match!.lineNumber).toBe(100);
		expect(thread2Match!.lineNumber).toBe(200);
	});

	it('should create synthetic spans for unmatched begins', () => {
		const matcher = new TransactionSpanMatcher();
		
		// Register some unmatched begins
		matcher.registerBegin('thread-1', 1, 1000, 10);
		matcher.registerBegin('thread-1', 2, 2000, 20);
		matcher.registerBegin('thread-2', 3, 3000, 30);
		
		// Create synthetic spans
		const syntheticSpans = matcher.createSyntheticSpansForUnmatchedBegins(100);
		
		expect(syntheticSpans).toHaveLength(3);
		
		// Check first span
		expect(syntheticSpans[0]).toEqual({
			thread: 'thread-1',
			startTime: 1000,
			spanStartEventId: 1,
			spanStartLine: 10,
			spanEndLine: 100
		});
		
		// Check second span
		expect(syntheticSpans[1]).toEqual({
			thread: 'thread-1',
			startTime: 2000,
			spanStartEventId: 2,
			spanStartLine: 20,
			spanEndLine: 100
		});
		
		// Check third span
		expect(syntheticSpans[2]).toEqual({
			thread: 'thread-2',
			startTime: 3000,
			spanStartEventId: 3,
			spanStartLine: 30,
			spanEndLine: 100
		});
	});

	it('should return empty array when no unmatched begins', () => {
		const matcher = new TransactionSpanMatcher();
		
		const syntheticSpans = matcher.createSyntheticSpansForUnmatchedBegins(100);
		
		expect(syntheticSpans).toHaveLength(0);
	});

	it('should handle missing line numbers in synthetic spans', () => {
		const matcher = new TransactionSpanMatcher();
		
		// Register begin without line number
		matcher.registerBegin('thread-1', 1, 1000);
		
		const syntheticSpans = matcher.createSyntheticSpansForUnmatchedBegins(100);
		
		expect(syntheticSpans).toHaveLength(1);
		expect(syntheticSpans[0].spanStartLine).toBe(0);
		expect(syntheticSpans[0].spanEndLine).toBe(100);
	});
});

describe('transaction lifecycle mapping expectations', () => {
	function normalizeTxLifecycleEvent(event?: string): TxLifecycleEvent | null {
		if (event === 'beginTransaction') return 'begin';
		if (event === 'commitTransaction') return 'commit';
		if (event === 'rollbackTransaction') return 'rollback';
		return null;
	}

	it('should normalize beginTransaction to begin', () => {
		expect(normalizeTxLifecycleEvent('beginTransaction')).toBe('begin');
	});

	it('should normalize commitTransaction to commit', () => {
		expect(normalizeTxLifecycleEvent('commitTransaction')).toBe('commit');
	});

	it('should normalize rollbackTransaction to rollback', () => {
		expect(normalizeTxLifecycleEvent('rollbackTransaction')).toBe('rollback');
	});

	it('should return null for unsupported transaction event names', () => {
		expect(normalizeTxLifecycleEvent('startTransaction')).toBeNull();
		expect(normalizeTxLifecycleEvent(undefined)).toBeNull();
	});
});

// Made with Bob
