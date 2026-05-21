/**
 * Storage utilities for checking IndexedDB quota and estimating requirements
 */

export interface StorageEstimate {
	available: number;
	used: number;
	quota: number;
	estimatedNeeded: number;
	sufficient: boolean;
}

/**
 * Check if there's sufficient storage for a file
 * @param fileSize Size of the file in bytes
 * @returns Storage estimate with availability check
 */
export async function checkStorageAvailability(fileSize: number): Promise<StorageEstimate> {
	// Conservative estimate: parsed data is typically 2-3x the XML size
	const estimatedNeeded = fileSize * 3;

	if (navigator.storage && navigator.storage.estimate) {
		try {
			const estimate = await navigator.storage.estimate();
			const quota = estimate.quota || 0;
			const used = estimate.usage || 0;
			const available = quota - used;

			return {
				available,
				used,
				quota,
				estimatedNeeded,
				sufficient: estimatedNeeded < available
			};
		} catch (error) {
			console.warn('Failed to estimate storage:', error);
		}
	}

	// Fallback if Storage API not available
	return {
		available: Infinity,
		used: 0,
		quota: Infinity,
		estimatedNeeded,
		sufficient: true // Assume sufficient if we can't check
	};
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	if (bytes === Infinity) return 'Unlimited';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Estimate processing time based on file size
 * Rough estimate: ~1 minute per 100MB
 */
export function estimateProcessingTime(fileSize: number): number {
	const MB = 1024 * 1024;
	const minutesPer100MB = 1;
	const minutes = (fileSize / (100 * MB)) * minutesPer100MB;
	return Math.ceil(minutes * 60); // Return seconds
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${Math.round(seconds)} seconds`;
	if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
	const hours = Math.floor(seconds / 3600);
	const mins = Math.round((seconds % 3600) / 60);
	return `${hours}h ${mins}m`;
}

// Made with Bob