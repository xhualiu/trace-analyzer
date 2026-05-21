<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { TraceEvent } from '$lib/types';
	import { selectedEvent } from '$lib/stores';
	import { onMount, afterUpdate } from 'svelte';

	export let events: TraceEvent[] = [];

	let expandedEvents = new Set<number>();
	let eventElements = new Map<number, HTMLElement>();
	let containerElement: HTMLElement;

	function toggleExpand(eventId: number | undefined) {
		if (eventId === undefined) return;
		
		if (expandedEvents.has(eventId)) {
			expandedEvents.delete(eventId);
		} else {
			expandedEvents.add(eventId);
		}
		expandedEvents = expandedEvents; // Trigger reactivity
	}

	function selectEvent(event: TraceEvent) {
		selectedEvent.set(event);
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
		<h2 class="text-lg font-semibold text-gray-900">
			Filtered Events ({events.length})
		</h2>
		<p class="text-xs text-gray-500 mt-1">Click to select, expand for details</p>
	</div>

	<div class="flex-1 overflow-auto" bind:this={containerElement}>
		{#if events.length === 0}
			<div class="flex items-center justify-center h-full p-4">
				<p class="text-gray-500 text-sm text-center">No events match current filters</p>
			</div>
		{:else}
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
							on:click={() => selectEvent(event)}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectEvent(event);
								}
							}}
							role="button"
							tabindex="0"
						>
							<button
								class="flex-shrink-0 p-1 hover:bg-white rounded"
								on:click|stopPropagation={() => toggleExpand(event.id)}
								title={expandedEvents.has(event.id!) ? 'Collapse' : 'Expand'}
							>
								{#if expandedEvents.has(event.id!)}
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
									Thread: {event.thread}
								</div>
								{#if event.type === 'sql' && event.sqlStatement}
									<div class="text-xs text-gray-500 truncate mt-1">
										{event.sqlStatement.substring(0, 100)}...
									</div>
								{/if}
							</div>
						</div>

						<!-- Expanded Details -->
						{#if expandedEvents.has(event.id!)}
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