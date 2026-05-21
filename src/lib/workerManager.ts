/**
 * Worker manager for handling parser worker communication
 * Manages worker lifecycle and message passing
 */

import type { WorkerMessage, TraceEvent } from './types';
import { workerProgress, workerStatus, traceMetadata, setError } from './stores';
import { db } from './db';

let worker: Worker | null = null;

/**
 * Initialize and start parsing a file
 */
export async function startParsing(file: File): Promise<void> {
	// Terminate existing worker if any
	if (worker) {
		worker.terminate();
	}

	// Clear existing data
	await db.events.clear();
	await db.metadata.clear();

	// Create new worker
	worker = new Worker(new URL('./workers/parser.worker.ts', import.meta.url), {
		type: 'module'
	});

	// Set up message handler
	worker.onmessage = async (event: MessageEvent) => {
		const message = event.data;

		if (message.type === 'progress') {
			const msg = message as WorkerMessage & { type: 'progress' };
			workerProgress.set(msg.progress);
			workerStatus.set(msg.status);
		} else if (message.type === 'error') {
			const msg = message as WorkerMessage & { type: 'error' };
			setError(msg.error + (msg.details ? `: ${msg.details}` : ''));
		} else if (message.type === 'complete') {
			const msg = message as WorkerMessage & { type: 'complete' };
			
			// Store metadata
			await db.metadata.add(msg.metadata);
			traceMetadata.set(msg.metadata);
			
			workerStatus.set('complete');
			workerProgress.set(100);
			
			// Extract unique threads and modes
			await extractMetadata();
		} else if (message.type === 'persist') {
			// Persist events to IndexedDB
			const events = message.events as TraceEvent[];
			try {
				await db.events.bulkAdd(events);
			} catch (error) {
				console.error('Failed to persist events:', error);
				setError('Failed to save events to database');
			}
		}
	};

	worker.onerror = (error) => {
		console.error('Worker error:', error);
		setError('Worker error: ' + error.message);
	};

	// Start parsing
	workerStatus.set('parsing');
	workerProgress.set(0);
	worker.postMessage({ type: 'parse', file });
}

/**
 * Extract metadata from stored events (threads, SQL modes, etc.)
 */
async function extractMetadata(): Promise<void> {
	try {
		// Get unique threads
		const threads = await db.events
			.orderBy('thread')
			.uniqueKeys();
		
		// Get unique SQL modes
		const sqlEvents = await db.events
			.where('type')
			.equals('sql')
			.toArray();
		
		const modes = new Set<string>();
		sqlEvents.forEach(event => {
			if (event.mode) {
				modes.add(event.mode);
			}
		});

		// Update stores (we'll need to import these)
		const { availableThreads, availableSqlModes, dbStats } = await import('./stores');
		availableThreads.set(threads as string[]);
		availableSqlModes.set(Array.from(modes));
		
		// Update stats
		const eventCount = await db.events.count();
		const metadata = await db.metadata.toArray();
		dbStats.set({
			eventCount,
			metadata: metadata[0] || null
		});
	} catch (error) {
		console.error('Failed to extract metadata:', error);
	}
}

/**
 * Terminate the worker
 */
export function terminateWorker(): void {
	if (worker) {
		worker.terminate();
		worker = null;
	}
}

// Made with Bob
