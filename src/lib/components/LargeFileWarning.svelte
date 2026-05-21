<script lang="ts">
	import { AlertTriangle, HardDrive, Clock, X } from 'lucide-svelte';
	import { formatBytes, formatDuration } from '$lib/storageUtils';
	import type { StorageEstimate } from '$lib/storageUtils';

	export let fileSize: number;
	export let fileName: string;
	export let storageEstimate: StorageEstimate;
	export let estimatedTime: number;
	export let onProceed: () => void;
	export let onCancel: () => void;

	const fileSizeMB = fileSize / (1024 * 1024);
	const isVeryLarge = fileSizeMB > 1000; // > 1GB
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
	<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
		<!-- Header -->
		<div class="p-6 border-b border-gray-200">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-amber-100 rounded-lg">
						<AlertTriangle class="w-6 h-6 text-amber-600" />
					</div>
					<div>
						<h2 class="text-xl font-semibold text-gray-900">Large File Warning</h2>
						<p class="text-sm text-gray-500 mt-1">Please review before proceeding</p>
					</div>
				</div>
				<button
					on:click={onCancel}
					class="p-1 hover:bg-gray-100 rounded transition-colors"
					aria-label="Close"
				>
					<X class="w-5 h-5 text-gray-500" />
				</button>
			</div>
		</div>

		<!-- Content -->
		<div class="p-6 space-y-6">
			<!-- File Info -->
			<div class="bg-gray-50 p-4 rounded-lg">
				<p class="text-sm font-medium text-gray-700 mb-2">File Information</p>
				<div class="space-y-1">
					<p class="text-sm text-gray-600">
						<span class="font-medium">Name:</span>
						{fileName}
					</p>
					<p class="text-sm text-gray-600">
						<span class="font-medium">Size:</span>
						{formatBytes(fileSize)}
						{#if isVeryLarge}
							<span class="ml-2 text-amber-600 font-medium">(Very Large)</span>
						{/if}
					</p>
				</div>
			</div>

			<!-- Processing Time Estimate -->
			<div class="flex items-start gap-3">
				<Clock class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
				<div class="flex-1">
					<p class="text-sm font-medium text-gray-900">Estimated Processing Time</p>
					<p class="text-sm text-gray-600 mt-1">
						Approximately <span class="font-medium text-blue-600"
							>{formatDuration(estimatedTime)}</span>
					</p>
					<p class="text-xs text-gray-500 mt-1">
						The browser will remain responsive, but parsing will run in the background.
					</p>
				</div>
			</div>

			<!-- Storage Requirements -->
			<div class="flex items-start gap-3">
				<HardDrive
					class={`w-5 h-5 mt-0.5 flex-shrink-0 ${storageEstimate.sufficient ? 'text-green-500' : 'text-red-500'}`}
				/>
				<div class="flex-1">
					<p class="text-sm font-medium text-gray-900">Storage Requirements</p>
					<div class="mt-2 space-y-1 text-sm text-gray-600">
						<p>
							<span class="font-medium">Estimated needed:</span>
							{formatBytes(storageEstimate.estimatedNeeded)}
						</p>
						<p>
							<span class="font-medium">Available:</span>
							{formatBytes(storageEstimate.available)}
						</p>
						{#if !storageEstimate.sufficient}
							<p class="text-red-600 font-medium mt-2">
								⚠️ Insufficient storage space available
							</p>
						{/if}
					</div>
					<p class="text-xs text-gray-500 mt-2">
						Parsed data is typically 2-3x the size of the XML file and will be stored in your
						browser's IndexedDB.
					</p>
				</div>
			</div>

			<!-- Recommendations -->
			{#if isVeryLarge}
				<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
					<p class="text-sm font-medium text-blue-900 mb-2">Recommendations for Large Files</p>
					<ul class="text-sm text-blue-800 space-y-1 list-disc list-inside">
						<li>Close other browser tabs to free up memory</li>
						<li>Ensure stable power supply (laptop plugged in)</li>
						<li>Don't close the browser tab during processing</li>
						<li>Consider filtering data after parsing to improve performance</li>
					</ul>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
			<button
				on:click={onCancel}
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
			>
				Cancel
			</button>
			<button
				on:click={onProceed}
				disabled={!storageEstimate.sufficient}
				class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
			>
				{storageEstimate.sufficient ? 'Proceed Anyway' : 'Insufficient Storage'}
			</button>
		</div>
	</div>
</div>

<style>
	/* Prevent body scroll when modal is open */
	:global(body:has(.fixed)) {
		overflow: hidden;
	}
</style>

<!-- Made with Bob -->