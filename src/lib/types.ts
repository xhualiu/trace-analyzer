/**
 * Type definitions for the Java Trace Analyzer
 * Based on spec.md section 6: Data Models
 */

export type TraceEventType = 'sql' | 'tx_event' | 'tx_span';
export type TxLifecycleEvent = 'begin' | 'commit' | 'rollback';

export interface ParsedParameter {
	index: number;
	raw: string; // Exact CDATA text, e.g. "Int: [2147483647]"
	type?: string; // e.g. "Int", "String"
	value?: string; // e.g. "2147483647", "Mauer.Sydney@mayo.edu"
}

export interface TraceEvent {
	id?: number; // Auto-incremented primary key

	type: TraceEventType;
	thread: string;
	startTime: number; // Epoch timestamp in milliseconds
	duration: number; // in milliseconds; 0 for instantaneous lifecycle markers unless derived otherwise
	lineNumber?: number; // XML line number for Y-axis positioning to prevent overlap

	// Common diagnostics
	sourceFile?: string;
	rawTime?: string;
	callStack?: string;
	parseWarnings?: string[];

	// SQL-specific
	sqlStatement?: string;
	parameters?: ParsedParameter[];
	mode?: string; // executeQuery, executeUpdate, etc.
	rowCount?: number; // mapped from XML "count"
	synthetic?: boolean; // true when synthetic millisecond offset was applied

	// Transaction lifecycle event-specific
	txEvent?: TxLifecycleEvent; // begin | commit | rollback
	txPairStatus?: 'matched' | 'unmatched';

	// Derived span-specific
	spanStartEventId?: number;
	spanEndEventId?: number;
}

export interface TraceFileMetadata {
	id?: number;
	sourceFile?: string;
	startDateRaw?: string;
	startDateEpoch?: number;
}

// Worker message types
export interface WorkerProgressMessage {
	type: 'progress';
	progress: number; // 0-100
	status: 'parsing' | 'persisting' | 'complete' | 'error';
	message?: string;
}

export interface WorkerErrorMessage {
	type: 'error';
	error: string;
	details?: string;
}

export interface WorkerCompleteMessage {
	type: 'complete';
	totalEvents: number;
	metadata: TraceFileMetadata;
}

export type WorkerMessage = WorkerProgressMessage | WorkerErrorMessage | WorkerCompleteMessage;

// Made with Bob
