<script lang="ts">
	import { X, Clock, Database, Code, AlertCircle } from 'lucide-svelte';
	import { selectedEvent } from '$lib/stores';
	import type { TraceEvent } from '$lib/types';

	function formatDuration(ms: number): string {
		if (ms < 1) return `${ms.toFixed(3)}ms`;
		if (ms < 1000) return `${ms.toFixed(2)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function formatTimestamp(ms: number): string {
		return new Date(ms).toISOString();
	}

	function closePanel() {
		selectedEvent.set(null);
	}

	$: event = $selectedEvent;
</script>

{#if event}
	<div class="h-full bg-white border-l border-gray-200 flex flex-col">
		<!-- Header -->
		<div class="p-4 border-b border-gray-200 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900">Event Details</h2>
			<button
				on:click={closePanel}
				class="p-1 hover:bg-gray-100 rounded transition-colors"
				aria-label="Close"
			>
				<X class="w-5 h-5 text-gray-500" />
			</button>
		</div>

		<!-- Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			<!-- Event Type Badge -->
			<div>
				<span
					class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
					class:bg-blue-100={event.type === 'sql'}
					class:text-blue-800={event.type === 'sql'}
					class:bg-purple-100={event.type === 'tx_span'}
					class:text-purple-800={event.type === 'tx_span'}
					class:bg-gray-100={event.type === 'tx_event'}
					class:text-gray-800={event.type === 'tx_event'}
				>
					{event.type.toUpperCase()}
					{#if event.txEvent}
						- {event.txEvent}
					{/if}
				</span>
			</div>

			<!-- Basic Info -->
			<div class="space-y-2">
				<div class="flex items-start gap-2">
					<Clock class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
					<div class="flex-1 min-w-0">
						<p class="text-xs text-gray-500">Thread</p>
						<p class="text-sm text-gray-900 font-mono break-all">{event.thread}</p>
					</div>
				</div>

				<div class="flex items-start gap-2">
					<Clock class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
					<div class="flex-1">
						<p class="text-xs text-gray-500">Duration</p>
						<p class="text-sm text-gray-900 font-medium">{formatDuration(event.duration)}</p>
					</div>
				</div>

				<div class="flex items-start gap-2">
					<Clock class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
					<div class="flex-1">
						<p class="text-xs text-gray-500">Start Time</p>
						<p class="text-sm text-gray-900 font-mono">{formatTimestamp(event.startTime)}</p>
						{#if event.rawTime}
							<p class="text-xs text-gray-500 mt-1">Raw: {event.rawTime}</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- SQL-specific Info -->
			{#if event.type === 'sql'}
				<div class="border-t border-gray-200 pt-4 space-y-3">
					{#if event.mode}
						<div class="flex items-start gap-2">
							<Database class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
							<div class="flex-1">
								<p class="text-xs text-gray-500">SQL Mode</p>
								<p class="text-sm text-gray-900 font-medium">{event.mode}</p>
							</div>
						</div>
					{/if}

					{#if event.rowCount !== undefined}
						<div class="flex items-start gap-2">
							<Database class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
							<div class="flex-1">
								<p class="text-xs text-gray-500">Row Count</p>
								<p class="text-sm text-gray-900 font-medium">{event.rowCount}</p>
							</div>
						</div>
					{/if}

					{#if event.synthetic}
						<div class="flex items-start gap-2">
							<AlertCircle class="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
							<div class="flex-1">
								<p class="text-xs text-amber-600">Synthetic time offset applied</p>
							</div>
						</div>
					{/if}

					<!-- SQL Statement -->
					{#if event.sqlStatement}
						<div>
							<div class="flex items-center gap-2 mb-2">
								<Code class="w-4 h-4 text-gray-400" />
								<p class="text-xs font-medium text-gray-700">SQL Statement</p>
							</div>
							<pre
								class="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto font-mono text-gray-800">{event.sqlStatement}</pre>
						</div>
					{/if}

					<!-- Parameters -->
					{#if event.parameters && event.parameters.length > 0}
						<div>
							<p class="text-xs font-medium text-gray-700 mb-2">Parameters</p>
							<div class="space-y-2">
								{#each event.parameters as param}
									<div class="bg-gray-50 p-2 rounded border border-gray-200">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-xs font-medium text-gray-500">#{param.index}</span>
											{#if param.type}
												<span class="text-xs text-blue-600 font-mono">{param.type}</span>
											{/if}
										</div>
										{#if param.value}
											<p class="text-sm text-gray-900 font-mono break-all">{param.value}</p>
										{:else}
											<p class="text-xs text-gray-500 italic">{param.raw}</p>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Transaction-specific Info -->
			{#if event.type === 'tx_span' || event.type === 'tx_event'}
				<div class="border-t border-gray-200 pt-4 space-y-3">
					{#if event.txPairStatus}
						<div class="flex items-start gap-2">
							<AlertCircle
								class={`w-4 h-4 mt-0.5 flex-shrink-0 ${event.txPairStatus === 'matched' ? 'text-green-500' : 'text-amber-500'}`}
							/>
							<div class="flex-1">
								<p class="text-xs text-gray-500">Pair Status</p>
								<p
									class="text-sm font-medium"
									class:text-green-600={event.txPairStatus === 'matched'}
									class:text-amber-600={event.txPairStatus === 'unmatched'}
								>
									{event.txPairStatus}
								</p>
							</div>
						</div>
					{/if}

					{#if event.spanStartEventId !== undefined}
						<div class="flex items-start gap-2">
							<Database class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
							<div class="flex-1">
								<p class="text-xs text-gray-500">Span Event IDs</p>
								<p class="text-sm text-gray-900 font-mono">
									Start: {event.spanStartEventId}
									{#if event.spanEndEventId}
										→ End: {event.spanEndEventId}
									{/if}
								</p>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Call Stack -->
			{#if event.callStack}
				<div class="border-t border-gray-200 pt-4">
					<div class="flex items-center gap-2 mb-2">
						<Code class="w-4 h-4 text-gray-400" />
						<p class="text-xs font-medium text-gray-700">Call Stack</p>
					</div>
					<pre
						class="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto font-mono text-gray-800 whitespace-pre-wrap break-all">{event.callStack}</pre>
				</div>
			{/if}

			<!-- Parse Warnings -->
			{#if event.parseWarnings && event.parseWarnings.length > 0}
				<div class="border-t border-gray-200 pt-4">
					<div class="flex items-center gap-2 mb-2">
						<AlertCircle class="w-4 h-4 text-amber-500" />
						<p class="text-xs font-medium text-amber-700">Parse Warnings</p>
					</div>
					<div class="space-y-1">
						{#each event.parseWarnings as warning}
							<p class="text-xs text-amber-600 bg-amber-50 p-2 rounded">{warning}</p>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Debug Info -->
			{#if event.id}
				<div class="border-t border-gray-200 pt-4">
					<p class="text-xs text-gray-500">Event ID: {event.id}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}