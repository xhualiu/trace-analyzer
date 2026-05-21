<script lang="ts">
	import { onMount } from 'svelte';

	export let direction: 'horizontal' | 'vertical' = 'horizontal';
	export let initialSize: number = 50; // percentage
	export let minSize: number = 10; // percentage
	export let maxSize: number = 90; // percentage

	let container: HTMLDivElement;
	let isDragging = false;
	let size = initialSize;

	function startDrag(e: MouseEvent) {
		isDragging = true;
		e.preventDefault();
	}

	function handleDrag(e: MouseEvent) {
		if (!isDragging || !container) return;

		const rect = container.getBoundingClientRect();
		let newSize: number;

		if (direction === 'horizontal') {
			// Horizontal split (top/bottom)
			const y = e.clientY - rect.top;
			newSize = (y / rect.height) * 100;
		} else {
			// Vertical split (left/right)
			const x = e.clientX - rect.left;
			newSize = (x / rect.width) * 100;
		}

		size = Math.max(minSize, Math.min(maxSize, newSize));
	}

	function stopDrag() {
		isDragging = false;
	}

	onMount(() => {
		document.addEventListener('mousemove', handleDrag);
		document.addEventListener('mouseup', stopDrag);

		return () => {
			document.removeEventListener('mousemove', handleDrag);
			document.removeEventListener('mouseup', stopDrag);
		};
	});
</script>

<div
	bind:this={container}
	class="relative w-full h-full"
	class:select-none={isDragging}
>
	{#if direction === 'horizontal'}
		<!-- Horizontal split: top and bottom -->
		<div class="absolute inset-0 flex flex-col">
			<div style="height: {size}%;" class="overflow-hidden">
				<slot name="first" />
			</div>
			
			<div
				class="h-1 bg-gray-200 hover:bg-blue-400 cursor-row-resize flex-shrink-0 relative group"
				on:mousedown={startDrag}
				role="separator"
				tabindex="0"
			>
				<div class="absolute inset-0 flex items-center justify-center">
					<div class="w-12 h-1 bg-gray-400 rounded group-hover:bg-blue-500"></div>
				</div>
			</div>
			
			<div style="height: {100 - size}%;" class="overflow-hidden flex-1">
				<slot name="second" />
			</div>
		</div>
	{:else}
		<!-- Vertical split: left and right -->
		<div class="absolute inset-0 flex">
			<div style="width: {size}%;" class="overflow-hidden">
				<slot name="first" />
			</div>
			
			<div
				class="w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group"
				on:mousedown={startDrag}
				role="separator"
				tabindex="0"
			>
				<div class="absolute inset-0 flex items-center justify-center">
					<div class="h-12 w-1 bg-gray-400 rounded group-hover:bg-blue-500"></div>
				</div>
			</div>
			
			<div style="width: {100 - size}%;" class="overflow-hidden flex-1">
				<slot name="second" />
			</div>
		</div>
	{/if}
</div>

<style>
	.select-none {
		user-select: none;
	}
</style>