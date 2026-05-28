/**
 * Web Worker for parsing trace XML files
 * Based on spec.md section 7.1: Parsing Engine (Web Worker)
 */

import { SaxesParser } from 'saxes';
import type { TraceEvent, TraceFileMetadata, ParsedParameter, WorkerMessage } from '../types';
import {
	parseJavaDateString,
	parseParameter,
	normalizeTxLifecycleEvent,
	SyntheticOffsetCalculator,
	TransactionSpanMatcher,
	findLongestCommonCallStackSuffix
} from '../parser/utils';

// Constants from spec
const BATCH_SIZE = 1000;
const MAX_WORKER_BUFFERED_EVENTS = 5000;

// Parser state
interface ParserState {
	metadata: TraceFileMetadata;
	currentElement: string;
	currentAttributes: Record<string, string>;
	currentText: string;
	currentEvent: Partial<TraceEvent> | null;
	currentParameters: ParsedParameter[];
	eventBuffer: TraceEvent[];
	totalEvents: number;
	offsetCalculator: SyntheticOffsetCalculator;
	spanMatcher: TransactionSpanMatcher;
	parseWarnings: string[];
	currentLineNumber: number; // Track actual XML file line number
	eventStartLine: number; // Line number where current event started
	lastLineNumber: number; // Track the last line number in the file
}

let state: ParserState;

/**
 * Initialize parser state
 */
function initState(): void {
	state = {
		metadata: {},
		currentElement: '',
		currentAttributes: {},
		currentText: '',
		currentEvent: null,
		currentParameters: [],
		eventBuffer: [],
		totalEvents: 0,
		offsetCalculator: new SyntheticOffsetCalculator(),
		spanMatcher: new TransactionSpanMatcher(),
		parseWarnings: [],
		currentLineNumber: 1, // Start at line 1
		eventStartLine: 0,
		lastLineNumber: 0
	};
}

/**
 * Send progress message to main thread
 */
function sendProgress(progress: number, status: 'parsing' | 'persisting' | 'complete' | 'error', message?: string): void {
	const msg: WorkerMessage = {
		type: 'progress',
		progress,
		status,
		message
	};
	self.postMessage(msg);
}

/**
 * Send error message to main thread
 */
function sendError(error: string, details?: string): void {
	const msg: WorkerMessage = {
		type: 'error',
		error,
		details
	};
	self.postMessage(msg);
}

/**
 * Send completion message to main thread
 */
function sendComplete(totalEvents: number, metadata: TraceFileMetadata): void {
	const msg: WorkerMessage = {
		type: 'complete',
		totalEvents,
		metadata
	};
	self.postMessage(msg);
}

/**
 * Flush event buffer to IndexedDB via main thread
 */
async function flushBuffer(): Promise<void> {
	if (state.eventBuffer.length === 0) return;

	sendProgress(0, 'persisting', `Persisting ${state.eventBuffer.length} events...`);

	// Send events to main thread for persistence
	self.postMessage({
		type: 'persist',
		events: state.eventBuffer
	});

	state.eventBuffer = [];
}

/**
 * Check if buffer needs flushing (called periodically during parsing)
 */
async function checkAndFlushBuffer(): Promise<void> {
	if (state.eventBuffer.length >= BATCH_SIZE) {
		await flushBuffer();
	}
}

/**
 * Handle opening tag
 */
function handleOpenTag(name: string, attributes: Record<string, string>): void {
	state.currentElement = name;
	state.currentAttributes = attributes;
	// Always reset text when opening a new tag to prevent cross-contamination
	state.currentText = '';

	if (name === 'teamserver-sql-log') {
		// Parse root metadata
		state.metadata = {
			sourceFile: attributes.file,
			startDateRaw: attributes.startDate,
			startDateEpoch: parseJavaDateString(attributes.startDate) || undefined
		};
	} else if (name === 'tx') {
		// Start transaction lifecycle event
		state.eventStartLine = state.currentLineNumber; // Capture line where event starts
		state.currentEvent = {
			type: 'tx_event',
			thread: attributes.thread,
			rawTime: attributes.time,
			txEvent: normalizeTxLifecycleEvent(attributes.event) ?? undefined,
			duration: 0,
			sourceFile: state.metadata.sourceFile,
			parseWarnings: [],
			lineNumber: state.eventStartLine
		};

		const startTime = parseJavaDateString(attributes.time);
		if (startTime === null) {
			state.currentEvent.parseWarnings!.push(`Invalid time format: ${attributes.time}`);
			state.currentEvent.startTime = 0;
		} else {
			state.currentEvent.startTime = startTime;
		}
	} else if (name === 'sql') {
		// Start SQL event
		state.eventStartLine = state.currentLineNumber; // Capture line where event starts
		const executionTime = parseInt(attributes.executionTime || '0', 10);
		const count = parseInt(attributes.count || '0', 10);

		state.currentEvent = {
			type: 'sql',
			thread: attributes.thread,
			mode: attributes.mode,
			rowCount: isNaN(count) ? 0 : count,
			rawTime: attributes.time,
			duration: isNaN(executionTime) ? 0 : executionTime,
			synthetic: true,
			sourceFile: state.metadata.sourceFile,
			parameters: [],
			parseWarnings: [],
			lineNumber: state.eventStartLine
		};

		const epochSecond = parseJavaDateString(attributes.time);
		if (epochSecond === null) {
			state.currentEvent.parseWarnings!.push(`Invalid time format: ${attributes.time}`);
			state.currentEvent.startTime = 0;
		} else {
			// Apply synthetic offset
			state.currentEvent.startTime = state.offsetCalculator.getSyntheticStartTime(
				attributes.thread,
				epochSecond,
				state.currentEvent.duration || 0
			);
		}
	} else if (name === 'parameter') {
		// Parameter will be collected in text handler
		state.currentParameters.push({
			index: parseInt(attributes.index || '0', 10),
			raw: ''
		});
	}
}

/**
 * Handle text content
 */
function handleText(text: string): void {
	state.currentText += text;
	// Count newlines to track line numbers
	const newlines = (text.match(/\n/g) || []).length;
	state.currentLineNumber += newlines;
}

/**
 * Handle CDATA content
 */
function handleCData(cdata: string): void {
	state.currentText += cdata;
	// Count newlines to track line numbers
	const newlines = (cdata.match(/\n/g) || []).length;
	state.currentLineNumber += newlines;
}

/**
 * Handle closing tag (synchronous version for saxes)
 */
function handleCloseTagSync(name: string): void {
	const text = state.currentText.trim();

	if (name === 'statement' && state.currentEvent) {
		state.currentEvent.sqlStatement = text;
		state.currentText = ''; // Clear after capturing
	} else if (name === 'callStack' && state.currentEvent) {
		state.currentEvent.callStack = text;
		state.currentText = ''; // Clear after capturing
	} else if (name === 'parameter' && state.currentParameters.length > 0) {
		const lastParam = state.currentParameters[state.currentParameters.length - 1];
		const parsed = parseParameter(lastParam.index, text);
		state.currentParameters[state.currentParameters.length - 1] = parsed;
		state.currentText = ''; // Clear after capturing
	} else if (name === 'sql' && state.currentEvent) {
		// Complete SQL event
		if (state.currentParameters.length > 0) {
			state.currentEvent.parameters = [...state.currentParameters];
		}

		if (!state.currentEvent.thread) {
			state.parseWarnings.push('SQL event missing thread attribute');
		} else {
			// Add to buffer synchronously
			state.eventBuffer.push(state.currentEvent as TraceEvent);
			state.totalEvents++;
		}

		state.currentEvent = null;
		state.currentParameters = [];
	} else if (name === 'tx' && state.currentEvent) {
		// Complete transaction lifecycle event
		if (!state.currentEvent.thread) {
			state.parseWarnings.push('TX event missing thread attribute');
		} else {
			const txEvent = state.currentEvent as TraceEvent;

			if (!txEvent.txEvent) {
				txEvent.parseWarnings = [...(txEvent.parseWarnings ?? []), 'Unsupported transaction event'];
				txEvent.txPairStatus = 'unmatched';
				state.eventBuffer.push(txEvent);
				state.totalEvents++;
			}
			else if (txEvent.txEvent === 'begin') {
				txEvent.txPairStatus = 'unmatched';
				state.eventBuffer.push(txEvent);
				state.totalEvents++;

				// Register begin with line number and call stack for span matching
				state.spanMatcher.registerBegin(
					txEvent.thread,
					state.totalEvents,
					txEvent.startTime,
					txEvent.lineNumber,
					txEvent.callStack
				);
			} else if (txEvent.txEvent === 'commit' || txEvent.txEvent === 'rollback') {
				// Try to match with begin
				const matchedBegin = state.spanMatcher.matchEnd(txEvent.thread);

				if (matchedBegin) {
					// Create derived span with line numbers and common call stack suffix
					const commonCallStack = findLongestCommonCallStackSuffix(matchedBegin.callStack, txEvent.callStack);
					
					const span: TraceEvent = {
						type: 'tx_span',
						thread: txEvent.thread,
						startTime: matchedBegin.startTime,
						duration: Math.max(0, txEvent.startTime - matchedBegin.startTime),
						txEvent: txEvent.txEvent,
						sourceFile: state.metadata.sourceFile,
						spanStartEventId: matchedBegin.eventId,
						spanEndEventId: state.totalEvents + 1, // provisional sequence id
						spanStartLine: matchedBegin.lineNumber,
						spanEndLine: txEvent.lineNumber,
						txPairStatus: 'matched',
						lineNumber: txEvent.lineNumber, // Use same line number as the end event
						callStack: commonCallStack // Use longest common suffix from bottom
					};

					txEvent.txPairStatus = 'matched';
					state.eventBuffer.push(txEvent);
					state.totalEvents++;
					state.eventBuffer.push(span);
					state.totalEvents++;
				} else {
					// No matching begin found - create synthetic span from line 1 to this end event
					// Use the end event's call stack since there's no begin event
					const syntheticSpan: TraceEvent = {
						type: 'tx_span',
						thread: txEvent.thread,
						startTime: txEvent.startTime, // Use end event's time as best estimate
						duration: 0, // Unknown duration
						txEvent: txEvent.txEvent,
						sourceFile: state.metadata.sourceFile,
						spanStartEventId: 0, // No actual begin event
						spanEndEventId: state.totalEvents + 1,
						spanStartLine: 1, // Assume span starts from beginning of file
						spanEndLine: txEvent.lineNumber,
						txPairStatus: 'unmatched',
						lineNumber: txEvent.lineNumber,
						callStack: txEvent.callStack, // Use end event's call stack
						parseWarnings: ['No matching begin event found - synthetic span created from file start']
					};

					txEvent.txPairStatus = 'unmatched';
					state.eventBuffer.push(txEvent);
					state.totalEvents++;
					state.eventBuffer.push(syntheticSpan);
					state.totalEvents++;
				}
			} else {
				// Unknown tx event type
				state.eventBuffer.push(txEvent);
				state.totalEvents++;
			}
		}

		state.currentEvent = null;
		state.currentText = ''; // Clear after completing event
	}
	
	// Note: currentText is cleared individually after capturing each nested element
	// (statement, callStack, parameter) to prevent cross-contamination
}

/**
 * Parse XML file
 */
async function parseFile(file: File): Promise<void> {
	initState();

	const parser = new SaxesParser();
	let bytesProcessed = 0;
	const totalBytes = file.size;

	parser.on('opentag', (tag) => {
		handleOpenTag(tag.name, tag.attributes as Record<string, string>);
	});

	parser.on('text', (text) => {
		handleText(text);
	});

	parser.on('cdata', (cdata) => {
		handleCData(cdata);
	});

	parser.on('closetag', (tag) => {
		// Note: saxes doesn't support async handlers, so we handle synchronously
		// and queue async operations
		handleCloseTagSync(tag.name);
	});

	parser.on('error', (error) => {
		sendError('XML parsing error', error.message);
	});

	// Read file in chunks
	const chunkSize = 10 * 1024 * 1024; // 10MB chunks
	const reader = file.stream().getReader();
	const decoder = new TextDecoder();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			parser.write(chunk);

			bytesProcessed += value.length;
			const progress = Math.floor((bytesProcessed / totalBytes) * 100);
			sendProgress(progress, 'parsing', `Parsing... ${progress}%`);

			// Check buffer size and flush if needed
			await checkAndFlushBuffer();
		}

		parser.close();

		// Update last line number
		state.lastLineNumber = state.currentLineNumber;

		// Create synthetic spans for any unmatched begins
		const syntheticSpans = state.spanMatcher.createSyntheticSpansForUnmatchedBegins(state.lastLineNumber);
		for (const spanData of syntheticSpans) {
			const syntheticSpan: TraceEvent = {
				type: 'tx_span',
				thread: spanData.thread,
				startTime: spanData.startTime,
				duration: 0, // Unknown duration since no end event
				txEvent: 'commit', // Assume commit for display purposes
				sourceFile: state.metadata.sourceFile,
				spanStartEventId: spanData.spanStartEventId,
				spanEndEventId: 0, // No actual end event
				spanStartLine: spanData.spanStartLine,
				spanEndLine: spanData.spanEndLine,
				txPairStatus: 'unmatched',
				lineNumber: spanData.spanStartLine,
				callStack: spanData.callStack, // Derive call stack from begin event
				parseWarnings: ['No matching end event found - synthetic span created to file end']
			};
			state.eventBuffer.push(syntheticSpan);
			state.totalEvents++;
		}

		// Flush remaining events (including synthetic spans)
		await flushBuffer();

		// Send completion
		sendComplete(state.totalEvents, state.metadata);
	} catch (error) {
		sendError('File reading error', error instanceof Error ? error.message : String(error));
	}
}

/**
 * Worker message handler
 */
self.onmessage = async (event: MessageEvent) => {
	const { type, file } = event.data;

	if (type === 'parse' && file instanceof File) {
		await parseFile(file);
	}
};

// Made with Bob
