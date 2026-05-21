/**
 * Dexie database schema for trace events
 * Based on spec.md section 6.3: Dexie Schema
 */

import Dexie, { type Table } from 'dexie';
import type { TraceEvent, TraceFileMetadata } from './types';

export class TraceDatabase extends Dexie {
	events!: Table<TraceEvent, number>;
	metadata!: Table<TraceFileMetadata, number>;

	constructor() {
		super('TraceAnalyzerDB');

		this.version(1).stores({
			events: '++id, type, thread, startTime, duration, [type+thread+startTime], mode',
			metadata: '++id'
		});
	}
}

// Singleton instance
export const db = new TraceDatabase();

/**
 * Clear all data from the database
 */
export async function clearDatabase(): Promise<void> {
	await db.events.clear();
	await db.metadata.clear();
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
	const eventCount = await db.events.count();
	const metadata = await db.metadata.toArray();

	return {
		eventCount,
		metadata: metadata[0] || null
	};
}

// Made with Bob
