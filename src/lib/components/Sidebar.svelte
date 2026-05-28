<script lang="ts">
	import { Filter, Clock, Database, Layers, Square, FileText } from 'lucide-svelte';
	import {
		activeThreads,
		methodFilter,
		minDuration,
		minSpanDuration,
		activeSqlModes,
		availableThreads,
		availableSqlModes,
		resetFilters,
		showTxSpans,
		showTxBegin,
		showTxCommit,
		showTxRollback,
		showSqlEvents,
		showSqlSelect,
		showSqlUpdate,
		showSqlDelete,
		showSqlInsert,
		showSqlOther
	} from '$lib/stores';

	function toggleThread(thread: string) {
		activeThreads.update((threads) => {
			if (threads.includes(thread)) {
				return threads.filter((t) => t !== thread);
			} else {
				return [...threads, thread];
			}
		});
	}

	function toggleSqlMode(mode: string) {
		activeSqlModes.update((modes) => {
			if (modes.includes(mode)) {
				return modes.filter((m) => m !== mode);
			} else {
				return [...modes, mode];
			}
		});
	}

	function selectAllThreads() {
		activeThreads.set([...$availableThreads]);
	}

	function deselectAllThreads() {
		activeThreads.set([]);
	}
</script>

<div class="h-full bg-white border-r border-gray-200 flex flex-col">
	<!-- Header -->
	<div class="p-4 border-b border-gray-200">
		<div class="flex items-center gap-2 mb-2">
			<Filter class="w-5 h-5 text-blue-600" />
			<h2 class="text-lg font-semibold text-gray-900">Filters</h2>
		</div>
		<button
			on:click={resetFilters}
			class="text-sm text-blue-600 hover:text-blue-700 font-medium"
		>
			Reset All
		</button>
	</div>

	<!-- Scrollable Content -->
	<div class="flex-1 overflow-y-auto p-4 space-y-6">
		<!-- Event Type Legend -->
		<div>
			<div class="flex items-center gap-2 mb-3">
				<Square class="w-4 h-4 text-gray-600" />
				<h3 class="font-medium text-gray-900">Event Types</h3>
			</div>
			
			<div class="space-y-2">
				<!-- SQL Events -->
				<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
					<input
						type="checkbox"
						bind:checked={$showSqlEvents}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<div class="flex items-center gap-2 flex-1">
						<div class="flex gap-1">
							<div class="w-4 h-4 rounded" style="background-color: #3b82f6;"></div>
							<div class="w-4 h-4 rounded" style="background-color: #ef4444;"></div>
						</div>
						<span class="text-sm text-gray-700">SQL Queries</span>
					</div>
				</label>
				<div class="ml-8 text-xs text-gray-500 space-y-0.5">
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded" style="background-color: #3b82f6;"></div>
						<span>Fast (≤500ms)</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded" style="background-color: #ef4444;"></div>
						<span>Slow (>500ms)</span>
					</div>
				</div>

				<!-- Transaction Spans -->
				<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
					<input
						type="checkbox"
						bind:checked={$showTxSpans}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<div class="flex items-center gap-2 flex-1">
						<div class="w-4 h-4 rounded" style="background-color: rgba(200, 200, 200, 0.5);"></div>
						<span class="text-sm text-gray-700">Transaction Spans</span>
					</div>
				</label>

				<!-- Transaction Markers -->
				<div class="ml-6 space-y-1">
					<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
						<input
							type="checkbox"
							bind:checked={$showTxBegin}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<div class="flex items-center gap-2 flex-1">
							<div class="w-1 h-4 rounded" style="background-color: #6b7280;"></div>
							<span class="text-sm text-gray-700">Begin</span>
						</div>
					</label>

					<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
						<input
							type="checkbox"
							bind:checked={$showTxCommit}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<div class="flex items-center gap-2 flex-1">
							<div class="w-1 h-4 rounded" style="background-color: #10b981;"></div>
							<span class="text-sm text-gray-700">Commit</span>
						</div>
					</label>

					<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
						<input
							type="checkbox"
							bind:checked={$showTxRollback}
							class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						/>
						<div class="flex items-center gap-2 flex-1">
							<div class="w-1 h-4 rounded" style="background-color: #f59e0b;"></div>
							<span class="text-sm text-gray-700">Rollback</span>
						</div>
					</label>
				</div>
			</div>
		</div>

		<!-- Thread Filter -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<div class="flex items-center gap-2">
					<Layers class="w-4 h-4 text-gray-600" />
					<h3 class="font-medium text-gray-900">Threads</h3>
				</div>
				<span class="text-xs text-gray-500">
					{$activeThreads.length}/{$availableThreads.length}
				</span>
			</div>

			{#if $availableThreads.length > 0}
				<div class="flex gap-2 mb-2">
					<button
						on:click={selectAllThreads}
						class="text-xs text-blue-600 hover:text-blue-700"
					>
						All
					</button>
					<span class="text-xs text-gray-400">|</span>
					<button
						on:click={deselectAllThreads}
						class="text-xs text-blue-600 hover:text-blue-700"
					>
						None
					</button>
				</div>

				<div class="space-y-1 max-h-48 overflow-y-auto">
					{#each $availableThreads as thread}
						<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
							<input
								type="checkbox"
								checked={$activeThreads.includes(thread)}
								on:change={() => toggleThread(thread)}
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-sm text-gray-700 truncate flex-1" title={thread}>
								{thread}
							</span>
						</label>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 italic">No threads available</p>
			{/if}
		</div>

		<!-- SQL Duration Filter -->
		<div>
			<div class="flex items-center gap-2 mb-2">
				<Clock class="w-4 h-4 text-gray-600" />
				<h3 class="font-medium text-gray-900">Min SQL Duration</h3>
			</div>

			<div class="space-y-2">
				<input
					type="range"
					min="0"
					max="1000"
					step="10"
					bind:value={$minDuration}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
				/>
				<div class="flex justify-between text-xs text-gray-600">
					<span>0ms</span>
					<span class="font-medium text-blue-600">{$minDuration}ms</span>
					<span>1000ms</span>
				</div>
			</div>
		</div>

		<!-- Transaction Span Duration Filter -->
		<div>
			<div class="flex items-center gap-2 mb-2">
				<Clock class="w-4 h-4 text-gray-600" />
				<h3 class="font-medium text-gray-900">Min Span Duration</h3>
			</div>

			<div class="space-y-2">
				<input
					type="range"
					min="0"
					max="5000"
					step="50"
					bind:value={$minSpanDuration}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
				/>
				<div class="flex justify-between text-xs text-gray-600">
					<span>0ms</span>
					<span class="font-medium text-blue-600">{$minSpanDuration}ms</span>
					<span>5000ms</span>
				</div>
				<p class="text-xs text-gray-500 italic">
					Filters transaction spans only. SQL events within long spans remain visible.
				</p>
			</div>
		</div>

		<!-- SQL Mode Filter -->
		<div>
			<div class="flex items-center gap-2 mb-2">
				<Database class="w-4 h-4 text-gray-600" />
				<h3 class="font-medium text-gray-900">SQL Modes</h3>
			</div>

			{#if $availableSqlModes.length > 0}
				<div class="space-y-1">
					{#each $availableSqlModes as mode}
						<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
							<input
								type="checkbox"
								checked={$activeSqlModes.includes(mode)}
								on:change={() => toggleSqlMode(mode)}
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-sm text-gray-700">{mode}</span>
						</label>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 italic">No SQL modes available</p>
			{/if}
		</div>

		<!-- SQL Statement Types Filter -->
		<div>
			<div class="flex items-center gap-2 mb-2">
				<FileText class="w-4 h-4 text-gray-600" />
				<h3 class="font-medium text-gray-900">SQL Statement Types</h3>
			</div>

			<div class="space-y-1">
				<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
					<input
						type="checkbox"
						bind:checked={$showSqlSelect}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">SELECT</span>
				</label>

				<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
					<input
						type="checkbox"
						bind:checked={$showSqlUpdate}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">UPDATE</span>
				</label>

				<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
					<input
						type="checkbox"
						bind:checked={$showSqlDelete}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">DELETE</span>
				</label>

				<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
					<input
						type="checkbox"
						bind:checked={$showSqlInsert}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">INSERT</span>
				</label>

				<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
					<input
						type="checkbox"
						bind:checked={$showSqlOther}
						class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">Other</span>
				</label>
			</div>
		</div>

		<!-- Method Filter -->
		<div>
			<div class="flex items-center gap-2 mb-2">
				<Filter class="w-4 h-4 text-gray-600" />
				<h3 class="font-medium text-gray-900">Method Filter</h3>
			</div>

			<input
				type="text"
				bind:value={$methodFilter}
				placeholder="Filter by method name..."
				class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
			<p class="mt-1 text-xs text-gray-500">
				Search in call stacks
			</p>
		</div>
	</div>

	<!-- Footer Stats -->
	<div class="p-4 border-t border-gray-200 bg-gray-50">
		<div class="text-xs text-gray-600 space-y-1">
			<div class="flex justify-between">
				<span>Active Filters:</span>
				<span class="font-medium">
					{($activeThreads.length > 0 ? 1 : 0) +
						($minDuration > 0 ? 1 : 0) +
						($methodFilter ? 1 : 0) +
						($activeSqlModes.length > 0 ? 1 : 0)}
				</span>
			</div>
		</div>
	</div>
</div>