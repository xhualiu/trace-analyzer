<script lang="ts">
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { FileUp, Loader2, PanelLeftClose, PanelLeftOpen } from 'lucide-svelte';
	import { startParsing } from '$lib/workerManager';
	import {
		workerStatus,
		workerProgress,
		uiError,
		traceMetadata,
		dbStats,
		activeThreads,
		minDuration,
		minSpanDuration,
		activeSqlModes,
		methodFilter,
		availableThreads,
		selectedEvent,
		eventsParsed,
		parsingRate,
		estimatedTimeRemaining,
		showSidebar,
		showTxSpans,
		showTxBegin,
		showTxCommit,
		showTxRollback,
		showSqlEvents,
		showSqlSelect,
		showSqlUpdate,
		showSqlDelete,
		showSqlInsert,
		showSqlOther,
		expandedEventIds
	} from '$lib/stores';
	import { db, getDatabaseStats } from '$lib/db';
	import TimelineCanvas from '$lib/components/TimelineCanvas.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import EventList from '$lib/components/EventList.svelte';
	import LargeFileWarning from '$lib/components/LargeFileWarning.svelte';
	import ResizablePanes from '$lib/components/ResizablePanes.svelte';
	import {
		checkStorageAvailability,
		estimateProcessingTime,
		formatDuration,
		type StorageEstimate
	} from '$lib/storageUtils';

	let fileInput: HTMLInputElement;
	let selectedFile: File | null = null;
	let showLargeFileWarning = false;
	let pendingFile: File | null = null;
	let storageEstimate: StorageEstimate | null = null;
	let estimatedTime = 0;

	const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500MB

	// Helper function to detect SQL statement type
	function getSqlStatementType(sqlStatement: string | undefined): string {
		if (!sqlStatement) return 'other';
		const normalized = sqlStatement.trim().toUpperCase();
		if (normalized.startsWith('SELECT')) return 'select';
		if (normalized.startsWith('UPDATE')) return 'update';
		if (normalized.startsWith('DELETE')) return 'delete';
		if (normalized.startsWith('INSERT')) return 'insert';
		return 'other';
	}

	// Reactive query for filtered events
	$: timelineData = liveQuery(async () => {
		if ($workerStatus !== 'complete') return [];

		let query = db.events.toCollection();

		// Apply filters
		const results = await query.toArray();

		// First pass: identify which spans pass the duration filter
		const validSpanIds = new Set<number>();
		const validSpanLineRanges: Array<{ minLine: number; maxLine: number; thread: string }> = [];
		
		for (const event of results) {
			if (event.type === 'tx_span' && event.duration >= $minSpanDuration) {
				if (event.id) {
					validSpanIds.add(event.id);
				}
				// Track line ranges of valid spans for filtering child events
				if (event.spanStartLine !== undefined && event.spanEndLine !== undefined) {
					const minLine = Math.min(event.spanStartLine, event.spanEndLine);
					const maxLine = Math.max(event.spanStartLine, event.spanEndLine);
					validSpanLineRanges.push({ minLine, maxLine, thread: event.thread });
				}
			}
		}

		// Helper function to check if an event belongs to a valid span
		const belongsToValidSpan = (event: typeof results[0]): boolean => {
			if (!event.lineNumber || !event.thread) return false;
			
			// Check if event falls within any valid span's line range
			for (const range of validSpanLineRanges) {
				if (event.thread === range.thread &&
				    event.lineNumber >= range.minLine &&
				    event.lineNumber <= range.maxLine) {
					return true;
				}
			}
			return false;
		};

		return results.filter((event) => {
			// Thread filter
			if ($activeThreads.length > 0 && !$activeThreads.includes(event.thread)) {
				return false;
			}

			// Event type filters
			if (event.type === 'sql' && !$showSqlEvents) {
				return false;
			}

			if (event.type === 'tx_span' && !$showTxSpans) {
				return false;
			}

			if (event.type === 'tx_event') {
				// Apply specific transaction event filters
				if (event.txEvent === 'begin' && !$showTxBegin) return false;
				if (event.txEvent === 'commit' && !$showTxCommit) return false;
				if (event.txEvent === 'rollback' && !$showTxRollback) return false;
			}

			// Type-specific filters
			if (event.type === 'sql') {
				// SQL duration filter (separate from span duration)
				if (event.duration < $minDuration) return false;

				// SQL mode filter
				if ($activeSqlModes.length > 0 && event.mode && !$activeSqlModes.includes(event.mode)) {
					return false;
				}

				// SQL statement type filter
				const statementType = getSqlStatementType(event.sqlStatement);
				if (statementType === 'select' && !$showSqlSelect) return false;
				if (statementType === 'update' && !$showSqlUpdate) return false;
				if (statementType === 'delete' && !$showSqlDelete) return false;
				if (statementType === 'insert' && !$showSqlInsert) return false;
				if (statementType === 'other' && !$showSqlOther) return false;

				// Method filter (search in call stack)
				if ($methodFilter && event.callStack) {
					if (!event.callStack.toLowerCase().includes($methodFilter.toLowerCase())) {
						return false;
					}
				}
			}

			// Transaction span duration filter (separate from SQL duration)
			if (event.type === 'tx_span') {
				if (event.duration < $minSpanDuration) return false;
			}

			// CRITICAL: If span duration filter is active, hide child events of filtered-out spans
			if ($minSpanDuration > 0 && (event.type === 'sql' || event.type === 'tx_event')) {
				// Only show events that belong to a valid span
				if (!belongsToValidSpan(event)) {
					return false;
				}
			}

			return true;
		});
	});

	// Extract unique threads for timeline
	$: threads = $availableThreads.filter((thread) => {
		if ($activeThreads.length === 0) return true;
		return $activeThreads.includes(thread);
	});

	// Handle double-click on timeline events to expand them in EventList
	function handleEventDoubleClick(event: TraceEvent) {
		if (!event.id) return;
		
		// Select the event
		selectedEvent.set(event);
		
		// Expand the event in EventList
		expandedEventIds.update(set => {
			const newSet = new Set(set);
			newSet.add(event.id!);
			
			// If this is a SQL event and we're in single-thread filtered view,
			// also expand its parent span (if it has one)
			if (event.type === 'sql' && $activeThreads.length === 1 && event.lineNumber) {
				// Find the parent span by checking which span contains this event's line number
				const parentSpan = ($timelineData || []).find(e => {
					if (e.type !== 'tx_span' || !e.id) return false;
					const minLine = Math.min(e.spanStartLine || 0, e.spanEndLine || 0);
					const maxLine = Math.max(e.spanStartLine || 0, e.spanEndLine || 0);
					return event.lineNumber! >= minLine && event.lineNumber! <= maxLine;
				});
				
				if (parentSpan?.id) {
					newSet.add(parentSpan.id);
				}
			}
			
			return newSet;
		});
	}

	onMount(async () => {
		// Load database stats on mount
		const stats = await getDatabaseStats();
		dbStats.set(stats);
	});

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];
			selectedEvent.set(null); // Clear selected event

			// Check if file is large (> 500MB)
			if (file.size > LARGE_FILE_THRESHOLD) {
				// Show warning modal
				pendingFile = file;
				storageEstimate = await checkStorageAvailability(file.size);
				estimatedTime = estimateProcessingTime(file.size);
				showLargeFileWarning = true;
			} else {
				// Proceed directly for smaller files
				selectedFile = file;
				await startParsing(file);
			}
		}
		// Reset file input so same file can be selected again
		target.value = '';
	}

	async function proceedWithLargeFile() {
		if (pendingFile) {
			showLargeFileWarning = false;
			selectedFile = pendingFile;
			await startParsing(pendingFile);
			pendingFile = null;
		}
	}

	function cancelLargeFile() {
		showLargeFileWarning = false;
		pendingFile = null;
		storageEstimate = null;
	}

	function triggerFileInput() {
		fileInput.click();
	}
</script>

<div class="h-screen flex flex-col bg-gray-50">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">Java Trace Analyzer</h1>
				<p class="text-sm text-gray-600 mt-1">
					Analyze SQL traces from Team Server (supports files up to 2GB+)
				</p>
			</div>

			<!-- File Upload Button -->
			<div>
				<input
					type="file"
					accept=".xml"
					bind:this={fileInput}
					on:change={handleFileSelect}
					class="hidden"
				/>

				<button
					on:click={triggerFileInput}
					disabled={$workerStatus === 'parsing' || $workerStatus === 'persisting'}
					class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
				>
					{#if $workerStatus === 'parsing' || $workerStatus === 'persisting'}
						<Loader2 class="w-5 h-5 animate-spin" />
						Processing...
					{:else}
						<FileUp class="w-5 h-5" />
						Load Trace File
					{/if}
				</button>
			</div>
		</div>

		<!-- Progress Bar -->
		{#if $workerStatus === 'parsing' || $workerStatus === 'persisting'}
			<div class="mt-4">
				<div class="flex justify-between text-sm text-gray-600 mb-1">
					<span class="capitalize">{$workerStatus}...</span>
					<span>{Math.round($workerProgress)}%</span>
				</div>
				<div class="w-full bg-gray-200 rounded-full h-2 mb-2">
					<div
						class="bg-blue-600 h-2 rounded-full transition-all duration-300"
						style="width: {$workerProgress}%"
					></div>
				</div>
				{#if $eventsParsed > 0}
					<div class="flex justify-between text-xs text-gray-500">
						<span>{$eventsParsed.toLocaleString()} events parsed</span>
						{#if $parsingRate > 0}
							<span>{Math.round($parsingRate).toLocaleString()} events/sec</span>
						{/if}
						{#if $estimatedTimeRemaining !== null && $estimatedTimeRemaining > 0}
							<span>~{formatDuration($estimatedTimeRemaining)} remaining</span>
						{/if}
					</div>
				{/if}
			</div>
			
			<!-- Large File Warning Modal -->
			{#if showLargeFileWarning && pendingFile && storageEstimate}
				<LargeFileWarning
					fileSize={pendingFile.size}
					fileName={pendingFile.name}
					{storageEstimate}
					{estimatedTime}
					onProceed={proceedWithLargeFile}
					onCancel={cancelLargeFile}
				/>
			{/if}
		{/if}

		<!-- Error Display -->
		{#if $uiError}
			<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
				<p class="text-red-800 font-medium text-sm">Error</p>
				<p class="text-red-600 text-sm mt-1">{$uiError}</p>
			</div>
		{/if}

		<!-- Success Display -->
		{#if $workerStatus === 'complete' && selectedFile}
			<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-green-800 font-medium text-sm">✓ Parsing Complete</p>
						<p class="text-green-600 text-xs mt-1">
							{selectedFile.name} - {$dbStats.eventCount} events loaded
						</p>
					</div>
					{#if $traceMetadata?.startDateRaw}
						<p class="text-green-600 text-xs">Start: {$traceMetadata.startDateRaw}</p>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- Main Content Area -->
	{#if $workerStatus === 'complete' && $dbStats.eventCount > 0}
		<div class="flex-1 overflow-hidden min-h-0">
			<!-- Resizable: Sidebar | Timeline + Details -->
			<ResizablePanes direction="vertical" initialSize={20} minSize={15} maxSize={40}>
				<svelte:fragment slot="first">
					<!-- Sidebar -->
					{#if $showSidebar}
						<div class="h-full border-r border-gray-200">
							<Sidebar />
						</div>
					{:else}
						<!-- Collapsed sidebar - show toggle button -->
						<div class="h-full flex items-start p-2 border-r border-gray-200">
							<button
								on:click={() => showSidebar.set(true)}
								class="p-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
								title="Show Sidebar"
							>
								<PanelLeftOpen class="w-4 h-4 text-gray-600" />
							</button>
						</div>
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="second">
					<!-- Resizable: Event List (Top) | Timeline (Bottom) -->
					<ResizablePanes direction="horizontal" initialSize={60} minSize={30} maxSize={80}>
						<svelte:fragment slot="first">
							<!-- Top: Event List (Full Width) -->
							<div class="h-full">
								{#if $timelineData && Array.isArray($timelineData)}
									<EventList events={$timelineData} />
								{/if}
							</div>
						</svelte:fragment>

						<svelte:fragment slot="second">
							<!-- Bottom: Timeline -->
							<div class="h-full relative border-t border-gray-200">
								{#if $timelineData && $timelineData.length > 0}
									<div class="h-full w-full overflow-auto">
										<TimelineCanvas
											events={$timelineData}
											{threads}
											onEventDoubleClick={handleEventDoubleClick}
										/>
									</div>
								{:else}
									<div class="h-full flex items-center justify-center bg-white">
										<div class="text-center">
											<p class="text-gray-500 text-lg mb-2">No events match current filters</p>
											<p class="text-gray-400 text-sm">Try adjusting your filter settings</p>
										</div>
									</div>
								{/if}
							</div>
						</svelte:fragment>
					</ResizablePanes>
				</svelte:fragment>
			</ResizablePanes>
		</div>
	{:else}
		<!-- Empty State -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center max-w-md">
				<FileUp class="w-16 h-16 text-gray-300 mx-auto mb-4" />
				<h2 class="text-xl font-semibold text-gray-700 mb-2">No Trace File Loaded</h2>
				<p class="text-gray-500 mb-6">
					Upload a traces.xml file to start analyzing SQL queries and transaction events
				</p>
				<button
					on:click={triggerFileInput}
					class="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
				>
					Select Trace File
				</button>
			</div>
		</div>
	{/if}
</div>