<script lang="ts">
	import { ChevronDown, ChevronRight, Filter, X } from 'lucide-svelte';
	import type { TraceEvent } from '$lib/types';
	import { selectedEvent, activeThreads, expandedEventIds } from '$lib/stores';
	import { onMount, afterUpdate } from 'svelte';
	import { removeCommonCallStackSuffix } from '$lib/parser/utils';

	export let events: TraceEvent[] = [];

	let eventElements = new Map<number, HTMLElement>();
	let containerElement: HTMLElement;

	// Track thread filter state
	let threadFilterActive = false;
	let filteredThreadName = '';
	
	$: {
		threadFilterActive = $activeThreads.length === 1;
		filteredThreadName = threadFilterActive ? $activeThreads[0] : '';
	}

	// Group events by transaction spans when single thread is active
	interface EventGroup {
		span: TraceEvent | null; // null for ungrouped events
		children: TraceEvent[];
	}

	$: groupedEvents = threadFilterActive ? groupEventsBySpan(events) : null;
	
	// Pre-compute line numbers for all spans to avoid SSR issues
	$: spanLineNumbers = new Map<number, { startLine: string | null, endLine: string | null }>(
		(groupedEvents || []).map(group => {
			if (!group.span || !group.span.id) return [0, { startLine: null, endLine: null }];
			const lineNums = getSpanLineNumbers(group.span, events);
			return [group.span.id, lineNums];
		})
	);

	function groupEventsBySpan(events: TraceEvent[]): EventGroup[] {
		const groups: EventGroup[] = [];
		
		// Early return if no events
		if (!Array.isArray(events) || events.length === 0) {
			return groups;
		}
		
		// Debug: Log sample events to check sourceFile format
		console.log('Sample events for grouping:', events.slice(0, 3).map(e => ({
			type: e.type,
			id: e.id,
			sourceFile: e.sourceFile,
			spanStartEventId: e.spanStartEventId,
			spanEndEventId: e.spanEndEventId
		})));
		
		// Sort by line number for reliable ordering
		const sortByLineNumber = (a: TraceEvent, b: TraceEvent) => {
			const lineA = a.lineNumber || 0;
			const lineB = b.lineNumber || 0;
			return lineA - lineB;
		};
		
		const spans = events.filter(e => e.type === 'tx_span').sort(sortByLineNumber);
		const nonSpanEvents = events.filter(e => e.type !== 'tx_span').sort(sortByLineNumber);
		
		console.log(`Found ${spans.length} transaction spans and ${nonSpanEvents.length} other events`);
		if (spans.length > 0) {
			console.log('First span:', {
				id: spans[0].id,
				sourceFile: spans[0].sourceFile,
				spanStartEventId: spans[0].spanStartEventId,
				spanEndEventId: spans[0].spanEndEventId
			});
		}
		
		// Create event lookup map for finding start/end events
		const eventMap = new Map<number, TraceEvent>();
		events.forEach(e => { if (e.id) eventMap.set(e.id, e); });
		
		// Track which events have been assigned to a span (to handle nested spans)
		const assignedEventIds = new Set<number>();
		
		// Process spans in reverse order (latest/innermost first) to handle nesting
		// This ensures events are assigned to the innermost span
		for (let i = spans.length - 1; i >= 0; i--) {
			const span = spans[i];
			const children: TraceEvent[] = [];
			
			// Use line numbers stored directly in the span (from parser)
			const spanStartLine = span.spanStartLine || 0;
			const spanEndLine = span.spanEndLine || 0;
			
			// Note: spanStartLine might be > spanEndLine if begin comes after commit in file
			const minLine = Math.min(spanStartLine, spanEndLine);
			const maxLine = Math.max(spanStartLine, spanEndLine);
			
			// Add all events within this span's line range (inclusive of boundaries)
			for (const event of nonSpanEvents) {
				if (event.id &&
				    !assignedEventIds.has(event.id) &&
				    event.lineNumber !== undefined) {
					const eventLine = event.lineNumber;
					// Include events between min and max lines (inclusive)
					// Only if we have valid line numbers
					if (minLine > 0 && maxLine > 0 &&
					    eventLine >= minLine && eventLine <= maxLine) {
						children.push(event);
						assignedEventIds.add(event.id);
					}
				}
			}
			
			// Sort children by line number to maintain XML order
			children.sort(sortByLineNumber);
			
			// Only add group if it has children
			if (children.length > 0) {
				groups.push({ span, children });
			}
		}
		
		// Reverse groups to show in chronological order (earliest span first)
		groups.reverse();
		
		// Add ungrouped events (those not within any span)
		const ungrouped = nonSpanEvents.filter(e => e.id && !assignedEventIds.has(e.id));
		
		if (ungrouped.length > 0) {
			groups.push({ span: null, children: ungrouped });
		}
		
		return groups;
	}
	
	// Helper function to get line numbers for span start/end events
	function getSpanLineNumbers(span: TraceEvent, events: TraceEvent[]): { startLine: string | null, endLine: string | null } {
		if (!span) {
			return { startLine: null, endLine: null };
		}
		
		// Use line numbers stored directly in the span (from parser)
		const beginLine = span.spanStartLine;
		const endLine = span.spanEndLine;
		
		if (beginLine !== undefined && endLine !== undefined) {
			// Return in ascending numerical order
			const minLine = Math.min(beginLine, endLine);
			const maxLine = Math.max(beginLine, endLine);
			return {
				startLine: minLine.toString(),
				endLine: maxLine.toString()
			};
		}
		
		return {
			startLine: beginLine?.toString() || null,
			endLine: endLine?.toString() || null
		};
	}

	function toggleExpand(eventId: number | undefined) {
		if (eventId === undefined) return;
		
		expandedEventIds.update(set => {
			const newSet = new Set(set);
			if (newSet.has(eventId)) {
				newSet.delete(eventId);
			} else {
				newSet.add(eventId);
			}
			return newSet;
		});
	}

	function selectEvent(event: TraceEvent) {
		selectedEvent.set(event);
	}

	function filterByThread(threadName: string) {
		activeThreads.set([threadName]);
	}

	function clearThreadFilter() {
		activeThreads.set([]);
	}

	// Function to register element reference
	function registerElement(node: HTMLElement, eventId: number) {
		eventElements.set(eventId, node);
		return {
			destroy() {
				eventElements.delete(eventId);
			}
		};
	}

	// Scroll to selected event when it changes
	$: if ($selectedEvent && $selectedEvent.id && eventElements.has($selectedEvent.id)) {
		const element = eventElements.get($selectedEvent.id);
		if (element && containerElement) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3
		});
	}

	function getEventColor(event: TraceEvent): string {
		if (event.type === 'sql') {
			return event.duration > 500 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200';
		} else if (event.type === 'tx_span') {
			return 'bg-gray-50 border-gray-300';
		} else if (event.type === 'tx_event') {
			if (event.txEvent === 'begin') return 'bg-purple-50 border-purple-200';
			if (event.txEvent === 'commit') return 'bg-green-50 border-green-200';
			if (event.txEvent === 'rollback') return 'bg-amber-50 border-amber-200';
		}
		return 'bg-white border-gray-200';
	}

	function getEventTypeLabel(event: TraceEvent): string {
		if (event.type === 'sql') return 'SQL Query';
		if (event.type === 'tx_span') return 'Transaction Span';
		if (event.type === 'tx_event') {
			if (event.txEvent === 'begin') return 'TX Begin';
			if (event.txEvent === 'commit') return 'TX Commit';
			if (event.txEvent === 'rollback') return 'TX Rollback';
		}
		return event.type;
	}
</script>

<div class="h-full flex flex-col bg-gray-50">
	<div class="p-4 border-b border-gray-200 bg-white">
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-lg font-semibold text-gray-900">
				Filtered Events ({events.length})
			</h2>
			{#if threadFilterActive}
				<div class="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
					<Filter size={14} />
					<span class="font-medium">Thread: {filteredThreadName}</span>
					<button
						on:click={clearThreadFilter}
						class="ml-1 hover:bg-blue-200 rounded p-0.5 transition-colors"
						title="Clear thread filter"
					>
						<X size={14} />
					</button>
				</div>
			{/if}
		</div>
		<p class="text-xs text-gray-500 mt-1">
			{#if threadFilterActive && groupedEvents}
				Grouped by transaction spans ({groupedEvents.length} groups)
			{:else if threadFilterActive}
				Showing only events from thread: {filteredThreadName}
			{:else}
				Click to select, expand for details. Double-click thread to filter.
			{/if}
		</p>
	</div>

	<div class="flex-1 overflow-auto" bind:this={containerElement}>
		{#if events.length === 0}
			<div class="flex items-center justify-center h-full p-4">
				<p class="text-gray-500 text-sm text-center">No events match current filters</p>
			</div>
		{:else if groupedEvents}
			<!-- Grouped view by transaction spans -->
			<div class="p-2 space-y-3">
				{#each groupedEvents as group, groupIndex (group.span?.id || `ungrouped-${groupIndex}`)}
					<div class="border-2 border-purple-300 rounded-lg overflow-hidden bg-purple-50/30">
						<!-- Transaction Span Header -->
						{#if group.span}
							<div
								use:registerElement={group.span.id!}
								class="bg-purple-100 border-b-2 border-purple-300 p-3 cursor-pointer hover:bg-purple-150"
								class:ring-2={$selectedEvent?.id === group.span.id}
								class:ring-purple-500={$selectedEvent?.id === group.span.id}
								on:click={() => {
									selectEvent(group.span!);
									toggleExpand(group.span!.id);
								}}
								on:keydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										selectEvent(group.span!);
										toggleExpand(group.span!.id);
									}
								}}
								role="button"
								tabindex="0"
							>
								<div class="flex items-center gap-2">
									<button
										class="flex-shrink-0 p-1 hover:bg-purple-200 rounded"
										on:click|stopPropagation={() => toggleExpand(group.span!.id)}
										title={$expandedEventIds.has(group.span!.id!) ? 'Collapse' : 'Expand'}
									>
										{#if $expandedEventIds.has(group.span!.id!)}
											<ChevronDown class="w-5 h-5 text-purple-700" />
										{:else}
											<ChevronRight class="w-5 h-5 text-purple-700" />
										{/if}
									</button>
									<div class="flex-1">
										<div class="flex items-center gap-2 flex-wrap">
											<span class="text-sm font-bold text-purple-900">
												Transaction Span
											</span>
											<span class="text-sm font-semibold text-purple-700">
												{group.span.duration}ms
											</span>
											<span class="text-xs text-purple-600">
												{formatTime(group.span.startTime)}
											</span>
											{#if group.span.id && spanLineNumbers.has(group.span.id)}
												{@const lineNumbers = spanLineNumbers.get(group.span.id)}
												{#if lineNumbers && lineNumbers.startLine && lineNumbers.endLine}
													<span class="text-xs text-purple-600">
														Lines {lineNumbers.startLine}–{lineNumbers.endLine}
													</span>
												{/if}
											{/if}
											<span class="text-xs text-purple-600 ml-auto">
												{group.children.length} events
											</span>
										</div>
									</div>
								</div>
							</div>
							
							<!-- Expanded Details for Transaction Span -->
							{#if $expandedEventIds.has(group.span.id!)}
								<div class="border-t border-purple-300 bg-purple-50 p-3 space-y-2">
									<div class="grid grid-cols-2 gap-2 text-xs">
										<div>
											<span class="font-semibold text-purple-700">Type:</span>
											<span class="text-purple-600 ml-1">Transaction Span</span>
										</div>
										<div>
											<span class="font-semibold text-purple-700">Duration:</span>
											<span class="text-purple-600 ml-1">{group.span.duration}ms</span>
										</div>
										{#if group.span.txEvent}
											<div>
												<span class="font-semibold text-purple-700">End Event:</span>
												<span class="text-purple-600 ml-1">{group.span.txEvent}</span>
											</div>
										{/if}
										{#if group.span.txPairStatus}
											<div>
												<span class="font-semibold text-purple-700">Status:</span>
												<span class="text-purple-600 ml-1">{group.span.txPairStatus}</span>
											</div>
										{/if}
									</div>
									
									{#if group.span.callStack}
										<div>
											<div class="font-semibold text-purple-700 text-xs mb-1">Call Stack (Common Suffix):</div>
											<pre class="text-xs bg-white p-2 rounded border border-purple-200 overflow-x-auto max-h-48">{group.span.callStack}</pre>
										</div>
									{/if}
									
									{#if group.span.parseWarnings && group.span.parseWarnings.length > 0}
										<div>
											<div class="font-semibold text-amber-700 text-xs mb-1">Warnings:</div>
											<div class="space-y-1">
												{#each group.span.parseWarnings as warning}
													<div class="text-xs bg-amber-50 p-1 rounded border border-amber-200 text-amber-700">
														{warning}
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/if}
						{:else}
							<!-- Ungrouped events header -->
							<div class="bg-gray-100 border-b border-gray-300 p-2">
								<span class="text-xs font-semibold text-gray-600">
									Ungrouped Events ({group.children.length})
								</span>
							</div>
						{/if}

						<!-- Child events (only show if span is expanded or if ungrouped) -->
						{#if !group.span || $expandedEventIds.has(group.span.id!)}
							<div class="p-2 space-y-2 bg-white">
								{#each group.children as event (event.id)}
								<div
									use:registerElement={event.id!}
									class="border rounded-md overflow-hidden {getEventColor(event)} transition-all ml-4"
									class:ring-2={$selectedEvent?.id === event.id}
									class:ring-blue-500={$selectedEvent?.id === event.id}
								>
									<!-- Event Header -->
									<div
										class="flex items-center gap-2 p-2 cursor-pointer hover:bg-white/50"
										on:click={() => {
											selectEvent(event);
											toggleExpand(event.id);
										}}
										on:keydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												selectEvent(event);
												toggleExpand(event.id);
											}
										}}
										role="button"
										tabindex="0"
									>
										<button
											class="flex-shrink-0 p-1 hover:bg-white rounded"
											on:click|stopPropagation={() => toggleExpand(event.id)}
											title={$expandedEventIds.has(event.id!) ? 'Collapse' : 'Expand'}
										>
											{#if $expandedEventIds.has(event.id!)}
												<ChevronDown class="w-3 h-3 text-gray-600" />
											{:else}
												<ChevronRight class="w-3 h-3 text-gray-600" />
											{/if}
										</button>

										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-1 flex-wrap">
												<span class="text-xs font-semibold text-gray-700">
													{getEventTypeLabel(event)}
												</span>
												<span class="text-xs text-gray-500">
													{formatTime(event.startTime)}
												</span>
												<span class="text-xs font-medium text-gray-700">
													{event.duration}ms
												</span>
												{#if event.lineNumber !== undefined}
													<span class="text-xs text-gray-400 ml-auto">
														Line {event.lineNumber}
													</span>
												{/if}
											</div>
											{#if event.type === 'sql' && event.sqlStatement}
												<div class="text-xs text-gray-500 truncate">
													{event.sqlStatement.substring(0, 80)}...
												</div>
											{/if}
										</div>
									</div>

									<!-- Expanded Details (same as before) -->
									{#if $expandedEventIds.has(event.id!)}
										<div class="border-t border-gray-300 bg-white p-3 space-y-2">
											<div class="grid grid-cols-2 gap-2 text-xs">
												<div>
													<span class="font-semibold text-gray-700">Type:</span>
													<span class="text-gray-600 ml-1">{event.type}</span>
												</div>
												<div>
													<span class="font-semibold text-gray-700">Duration:</span>
													<span class="text-gray-600 ml-1">{event.duration}ms</span>
												</div>
												{#if event.rawTime}
													<div class="col-span-2">
														<span class="font-semibold text-gray-700">Time:</span>
														<span class="text-gray-600 ml-1">{event.rawTime}</span>
													</div>
												{/if}
												{#if event.mode}
													<div>
														<span class="font-semibold text-gray-700">Mode:</span>
														<span class="text-gray-600 ml-1">{event.mode}</span>
													</div>
												{/if}
												{#if event.rowCount !== undefined}
													<div>
														<span class="font-semibold text-gray-700">Rows:</span>
														<span class="text-gray-600 ml-1">{event.rowCount}</span>
													</div>
												{/if}
											</div>

											{#if event.sqlStatement}
												<div>
													<div class="font-semibold text-gray-700 text-xs mb-1">SQL Statement:</div>
													<pre class="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto max-h-32">{event.sqlStatement}</pre>
												</div>
											{/if}

											{#if event.parameters && event.parameters.length > 0}
												<div>
													<div class="font-semibold text-gray-700 text-xs mb-1">Parameters:</div>
													<div class="space-y-1">
														{#each event.parameters as param}
															<div class="text-xs bg-gray-50 p-1 rounded border border-gray-200">
																<span class="font-medium text-gray-700">#{param.index}:</span>
																{#if param.type && param.value}
																	<span class="text-gray-600">{param.type}: {param.value}</span>
																{:else}
																	<span class="text-gray-600">{param.raw}</span>
																{/if}
															</div>
														{/each}
													</div>
												</div>
											{/if}

											{#if event.callStack}
												{@const uniqueStack = group.span ? removeCommonCallStackSuffix(event.callStack, group.span.callStack) : event.callStack}
												{#if uniqueStack}
													<div>
														<div class="font-semibold text-gray-700 text-xs mb-1">
															Call Stack:
															{#if group.span}
																<span class="text-gray-500 font-normal">(unique portion)</span>
															{/if}
														</div>
														<pre class="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto max-h-48">{uniqueStack}</pre>
													</div>
												{:else if group.span}
													<div>
														<div class="font-semibold text-gray-700 text-xs mb-1">Call Stack:</div>
														<div class="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-200">
															Same as transaction span (see span details above)
														</div>
													</div>
												{/if}
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					</div>
				{/each}
			</div>
		{:else}
			<!-- Flat view (original) -->
			<div class="p-2 space-y-2">
				{#each events as event (event.id)}
					<div
						use:registerElement={event.id!}
						class="border rounded-md overflow-hidden {getEventColor(event)} transition-all"
						class:ring-2={$selectedEvent?.id === event.id}
						class:ring-blue-500={$selectedEvent?.id === event.id}
					>
						<!-- Event Header -->
						<div
							class="flex items-center gap-2 p-3 cursor-pointer hover:bg-white/50"
							on:click={() => {
								selectEvent(event);
								toggleExpand(event.id);
							}}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectEvent(event);
									toggleExpand(event.id);
								}
							}}
							role="button"
							tabindex="0"
						>
							<button
								class="flex-shrink-0 p-1 hover:bg-white rounded"
								on:click|stopPropagation={() => toggleExpand(event.id)}
								title={$expandedEventIds.has(event.id!) ? 'Collapse' : 'Expand'}
							>
								{#if $expandedEventIds.has(event.id!)}
									<ChevronDown class="w-4 h-4 text-gray-600" />
								{:else}
									<ChevronRight class="w-4 h-4 text-gray-600" />
								{/if}
							</button>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1 flex-wrap">
									<span class="text-xs font-semibold text-gray-700">
										{getEventTypeLabel(event)}
									</span>
									<span class="text-xs text-gray-500">
										{formatTime(event.startTime)}
									</span>
									<span class="text-xs font-medium text-gray-700">
										{event.duration}ms
									</span>
									{#if event.lineNumber !== undefined}
										<span class="text-xs text-gray-400 ml-auto">
											Line {event.lineNumber}
										</span>
									{/if}
								</div>
								<div class="text-xs text-gray-600 truncate">
									Thread: <button
										class="hover:underline cursor-pointer text-left font-normal"
										on:dblclick|stopPropagation={() => filterByThread(event.thread)}
										on:click|stopPropagation={() => {}}
										title="Double-click to filter by this thread"
									>{event.thread}</button>
								</div>
								{#if event.type === 'sql' && event.sqlStatement}
									<div class="text-xs text-gray-500 truncate mt-1">
										{event.sqlStatement.substring(0, 100)}...
									</div>
								{/if}
							</div>
						</div>

						<!-- Expanded Details -->
						{#if $expandedEventIds.has(event.id!)}
							<div class="border-t border-gray-300 bg-white p-3 space-y-2">
								<div class="grid grid-cols-2 gap-2 text-xs">
									<div>
										<span class="font-semibold text-gray-700">Type:</span>
										<span class="text-gray-600 ml-1">{event.type}</span>
									</div>
									<div>
										<span class="font-semibold text-gray-700">Duration:</span>
										<span class="text-gray-600 ml-1">{event.duration}ms</span>
									</div>
									<div class="col-span-2">
										<span class="font-semibold text-gray-700">Thread:</span>
										<span class="text-gray-600 ml-1">{event.thread}</span>
									</div>
									{#if event.rawTime}
										<div class="col-span-2">
											<span class="font-semibold text-gray-700">Time:</span>
											<span class="text-gray-600 ml-1">{event.rawTime}</span>
										</div>
									{/if}
									{#if event.mode}
										<div>
											<span class="font-semibold text-gray-700">Mode:</span>
											<span class="text-gray-600 ml-1">{event.mode}</span>
										</div>
									{/if}
									{#if event.rowCount !== undefined}
										<div>
											<span class="font-semibold text-gray-700">Rows:</span>
											<span class="text-gray-600 ml-1">{event.rowCount}</span>
										</div>
									{/if}
								</div>

								{#if event.sqlStatement}
									<div>
										<div class="font-semibold text-gray-700 text-xs mb-1">SQL Statement:</div>
										<pre class="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto max-h-32">{event.sqlStatement}</pre>
									</div>
								{/if}

								{#if event.parameters && event.parameters.length > 0}
									<div>
										<div class="font-semibold text-gray-700 text-xs mb-1">Parameters:</div>
										<div class="space-y-1">
											{#each event.parameters as param}
												<div class="text-xs bg-gray-50 p-2 rounded border border-gray-200">
													<span class="font-medium text-gray-700">[{param.index}]</span>
													{#if param.type && param.value}
														<span class="text-gray-600">{param.type}: {param.value}</span>
													{:else}
														<span class="text-gray-600">{param.raw}</span>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}

								{#if event.callStack}
									<div>
										<div class="font-semibold text-gray-700 text-xs mb-1">Call Stack:</div>
										<pre class="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto max-h-40">{event.callStack}</pre>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>