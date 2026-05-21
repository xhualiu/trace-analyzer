<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Konva from 'konva/lib/Core';
	import { Stage } from 'konva/lib/Stage';
	import { Layer } from 'konva/lib/Layer';
	import { Rect } from 'konva/lib/shapes/Rect';
	import { Text } from 'konva/lib/shapes/Text';
	import { Line } from 'konva/lib/shapes/Line';
	import type { TraceEvent } from '$lib/types';
	import { selectedEvent } from '$lib/stores';

	export let events: TraceEvent[] = [];
	export let threads: string[] = [];

	let container: HTMLDivElement;
	let stage: Stage | null = null;
	let labelLayer: Layer | null = null; // Fixed layer for thread labels
	let timelineLayer: Layer | null = null; // Draggable/zoomable layer for events
	let dividerLayer: Layer | null = null; // Layer for resizable divider

	// Layout constants - responsive to container size
	let ROW_HEIGHT = 50;
	let ROW_PADDING = 10;
	let LABEL_WIDTH = 200; // Now adjustable via divider
	let MIN_EVENT_WIDTH = 2;
	let TIMELINE_PADDING = 20;
	let EVENT_HEIGHT = 8; // Height of individual event bars within a row
	let EVENT_VERTICAL_SPACING = 2; // Spacing between stacked events
	let isDraggingDivider = false;

	// Color scheme
	const COLORS = {
		txSpan: 'rgba(200, 200, 200, 0.3)',
		sqlFast: '#3b82f6', // blue-600
		sqlSlow: '#ef4444', // red-600
		txBegin: '#6b7280', // gray-500
		txCommit: '#10b981', // green-500
		txRollback: '#f59e0b', // amber-500
		selected: '#8b5cf6' // purple-600
	};

	// Calculate time range
	$: timeRange = calculateTimeRange(events);
	$: scale = calculateScale(timeRange);

	function calculateTimeRange(events: TraceEvent[]): { min: number; max: number } {
		if (events.length === 0) {
			return { min: 0, max: 1000 };
		}

		let min = Infinity;
		let max = -Infinity;

		events.forEach((event) => {
			if (event.startTime < min) min = event.startTime;
			const endTime = event.startTime + event.duration;
			if (endTime > max) max = endTime;
		});

		return { min, max };
	}

	function calculateScale(range: { min: number; max: number }): number {
		const availableWidth = (container?.clientWidth || 1000) - LABEL_WIDTH - TIMELINE_PADDING * 2;
		const timeSpan = range.max - range.min || 1;
		return availableWidth / timeSpan;
	}

	function getEventColor(event: TraceEvent): string {
		if (event.type === 'tx_span') {
			return COLORS.txSpan;
		} else if (event.type === 'sql') {
			return event.duration > 500 ? COLORS.sqlSlow : COLORS.sqlFast;
		} else if (event.type === 'tx_event') {
			if (event.txEvent === 'begin') return COLORS.txBegin;
			if (event.txEvent === 'commit') return COLORS.txCommit;
			if (event.txEvent === 'rollback') return COLORS.txRollback;
		}
		return '#000000';
	}

	function timeToX(time: number): number {
		// Return X coordinate relative to timeline layer (not including LABEL_WIDTH)
		return TIMELINE_PADDING + (time - timeRange.min) * scale;
	}

	function threadToY(thread: string): number {
		const index = threads.indexOf(thread);
		return index * ROW_HEIGHT + ROW_PADDING;
	}

	// Calculate Y position within a thread row based on line number
	function getEventY(event: TraceEvent): number {
		const threadY = threadToY(event.thread);
		// Use line number to offset within the row to prevent overlap
		const lineOffset = (event.lineNumber || 0) % Math.floor((ROW_HEIGHT - 2 * ROW_PADDING) / (EVENT_HEIGHT + EVENT_VERTICAL_SPACING));
		return threadY + ROW_PADDING + lineOffset * (EVENT_HEIGHT + EVENT_VERTICAL_SPACING);
	}

	function renderTimeline() {
		if (!container || !stage || !labelLayer || !timelineLayer) return;

		labelLayer.destroyChildren();
		timelineLayer.destroyChildren();

		// Draw thread labels and backgrounds in fixed layer
		threads.forEach((thread, index) => {
			const y = index * ROW_HEIGHT;

			// Background row (only in label area)
			const labelBg = new Rect({
				x: 0,
				y,
				width: LABEL_WIDTH,
				height: ROW_HEIGHT,
				fill: index % 2 === 0 ? '#f9fafb' : '#ffffff',
				listening: false
			});
			labelLayer!.add(labelBg);

			// Thread label
			const label = new Text({
				x: 10,
				y: y + ROW_HEIGHT / 2 - 8,
				text: thread,
				fontSize: 12,
				fontFamily: 'monospace',
				fill: '#374151',
				width: LABEL_WIDTH - 20,
				ellipsis: true,
				listening: false
			});
			labelLayer!.add(label);

			// Separator line (only in label area)
			const labelLine = new Line({
				points: [0, y + ROW_HEIGHT, LABEL_WIDTH, y + ROW_HEIGHT],
				stroke: '#e5e7eb',
				strokeWidth: 1,
				listening: false
			});
			labelLayer!.add(labelLine);

			// Background row in timeline area (relative to timeline layer)
			const timelineBg = new Rect({
				x: 0, // Start at 0 relative to timeline layer
				y,
				width: stage!.width() - LABEL_WIDTH,
				height: ROW_HEIGHT,
				fill: index % 2 === 0 ? '#f9fafb' : '#ffffff',
				listening: false
			});
			timelineLayer!.add(timelineBg);

			// Separator line in timeline area (relative to timeline layer)
			const timelineLine = new Line({
				points: [0, y + ROW_HEIGHT, stage!.width() - LABEL_WIDTH, y + ROW_HEIGHT],
				stroke: '#e5e7eb',
				strokeWidth: 1,
				listening: false
			});
			timelineLayer!.add(timelineLine);
		});

		// Draw events in timeline layer
		// First draw tx_span events (background)
		events
			.filter((e) => e.type === 'tx_span')
			.forEach((event) => {
				drawEvent(event);
			});

		// Then draw SQL events
		events
			.filter((e) => e.type === 'sql')
			.forEach((event) => {
				drawEvent(event);
			});

		// Finally draw tx_event markers
		events
			.filter((e) => e.type === 'tx_event')
			.forEach((event) => {
				drawEvent(event);
			});

		labelLayer.batchDraw();
		timelineLayer.batchDraw();
	}

	function drawEvent(event: TraceEvent) {
		if (!timelineLayer) return;

		const x = timeToX(event.startTime);
		const y = getEventY(event); // Use line-number-based Y position
		const width = Math.max(event.duration * scale, MIN_EVENT_WIDTH);
		const color = getEventColor(event);

		if (event.type === 'tx_event') {
			// Draw as vertical marker
			const marker = new Line({
				points: [x, y, x, y + EVENT_HEIGHT],
				stroke: color,
				strokeWidth: 3,
				lineCap: 'round'
			});

			marker.on('click', () => {
				selectedEvent.set(event);
			});

			marker.on('mouseenter', () => {
				container.style.cursor = 'pointer';
			});

			marker.on('mouseleave', () => {
				container.style.cursor = 'default';
			});

			timelineLayer.add(marker);
		} else {
			// Draw as rectangle
			const rect = new Rect({
				x,
				y,
				width,
				height: EVENT_HEIGHT,
				fill: color,
				cornerRadius: event.type === 'tx_span' ? 0 : 2,
				opacity: event.type === 'tx_span' ? 0.3 : 1
			});

			rect.on('click', () => {
				selectedEvent.set(event);
			});

			rect.on('mouseenter', () => {
				container.style.cursor = 'pointer';
				rect.opacity(event.type === 'tx_span' ? 0.5 : 0.8);
				timelineLayer!.batchDraw();
			});

			rect.on('mouseleave', () => {
				container.style.cursor = 'default';
				rect.opacity(event.type === 'tx_span' ? 0.3 : 1);
				timelineLayer!.batchDraw();
			});

			timelineLayer.add(rect);
		}
	}

	onMount(() => {
		if (!container) return;

		// Make responsive to container size
		const updateSize = () => {
			if (!container || !stage) return;
			const width = container.clientWidth;
			const height = Math.max(threads.length * ROW_HEIGHT, container.clientHeight);
			stage.width(width);
			stage.height(height);
		};

		const width = container.clientWidth;
		const height = Math.max(threads.length * ROW_HEIGHT, container.clientHeight);

		stage = new Stage({
			container,
			width,
			height,
			draggable: false // Stage itself is not draggable
		});

		// Create fixed label layer (not draggable/zoomable)
		labelLayer = new Layer({
			clipX: 0,
			clipY: 0,
			clipWidth: LABEL_WIDTH,
			clipHeight: height
		});
		stage.add(labelLayer);

		// Create timeline layer (draggable and zoomable)
		// Position it at LABEL_WIDTH so it starts after the labels
		timelineLayer = new Layer({
			x: LABEL_WIDTH, // Position layer after labels
			y: 0,
			draggable: true,
			clipX: 0, // Clip relative to layer's own coordinate system
			clipY: 0,
			clipWidth: width - LABEL_WIDTH,
			clipHeight: height,
			dragBoundFunc: function (pos) {
				// Allow free horizontal and vertical dragging
				// Keep X position at or to the left of LABEL_WIDTH
				return {
					x: Math.min(LABEL_WIDTH, pos.x), // Allow panning left, but not right past label boundary
					y: Math.min(0, Math.max(pos.y, -(stage!.height() - container.clientHeight))) // Allow vertical scroll within bounds
				};
			}
		});
		stage.add(timelineLayer);

		// Create divider layer for resizable divider
		dividerLayer = new Layer();
		stage.add(dividerLayer);

		// Draw resizable divider
		const divider = new Rect({
			x: LABEL_WIDTH - 2,
			y: 0,
			width: 4,
			height: height,
			fill: '#d1d5db',
			opacity: 0.5,
			draggable: true,
			dragBoundFunc: function (pos) {
				// Constrain divider to horizontal movement only, min 100px, max 400px
				return {
					x: Math.max(100, Math.min(400, pos.x)),
					y: 0
				};
			}
		});

		divider.on('mouseenter', () => {
			container.style.cursor = 'col-resize';
			divider.opacity(1);
			dividerLayer!.batchDraw();
		});

		divider.on('mouseleave', () => {
			if (!isDraggingDivider) {
				container.style.cursor = 'default';
				divider.opacity(0.5);
				dividerLayer!.batchDraw();
			}
		});

		divider.on('dragstart', () => {
			isDraggingDivider = true;
		});

		divider.on('dragmove', () => {
			const newLabelWidth = divider.x() + 2;
			LABEL_WIDTH = newLabelWidth;
			
			// Update timeline layer position to match new label width
			const currentScale = timelineLayer!.scaleX();
			const currentY = timelineLayer!.y();
			timelineLayer!.x(LABEL_WIDTH);
			timelineLayer!.y(currentY);
			
			// Update clipping regions
			labelLayer!.clipWidth(LABEL_WIDTH);
			timelineLayer!.clipX(0); // Clip relative to layer's coordinate system
			timelineLayer!.clipWidth(stage!.width() - LABEL_WIDTH);
			
			// Re-render with new label width
			renderTimeline();
		});

		divider.on('dragend', () => {
			isDraggingDivider = false;
			container.style.cursor = 'default';
			divider.opacity(0.5);
			dividerLayer!.batchDraw();
		});

		dividerLayer.add(divider);

		// Enable zoom with mouse wheel on timeline layer only
		stage.on('wheel', (e) => {
			e.evt.preventDefault();

			const oldScale = timelineLayer!.scaleX();
			const pointer = stage!.getPointerPosition();

			if (!pointer) return;

			// Only zoom if pointer is in timeline area (right of labels)
			if (pointer.x < LABEL_WIDTH) return;

			// Calculate mouse position relative to the timeline layer's content
			const mousePointTo = {
				x: (pointer.x - timelineLayer!.x()) / oldScale,
				y: (pointer.y - timelineLayer!.y()) / oldScale
			};

			const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;

			// Limit zoom
			const clampedScale = Math.max(0.1, Math.min(10, newScale));

			timelineLayer!.scale({ x: clampedScale, y: 1 }); // Only zoom X axis

			// Calculate new X position to keep mouse point stable
			let newX = pointer.x - mousePointTo.x * clampedScale;
			
			// Constrain: never allow layer to move right of LABEL_WIDTH
			newX = Math.min(LABEL_WIDTH, newX);
			
			// Also prevent zooming out too far left (optional, for better UX)
			// Calculate the rightmost edge of content
			const contentWidth = (stage!.width() - LABEL_WIDTH) * clampedScale;
			const minX = LABEL_WIDTH - contentWidth + (stage!.width() - LABEL_WIDTH);
			newX = Math.max(minX, newX);

			timelineLayer!.position({
				x: newX,
				y: timelineLayer!.y() // Preserve current Y position during zoom
			});
		});

		renderTimeline();

		// Handle window resize
		const handleResize = () => {
			if (container && stage && labelLayer && timelineLayer && dividerLayer) {
				updateSize();
				
				// Update clipping regions
				labelLayer.clipWidth(LABEL_WIDTH);
				labelLayer.clipHeight(stage.height());
				timelineLayer.clipX(0); // Clip relative to layer's coordinate system
				timelineLayer.clipWidth(stage.width() - LABEL_WIDTH);
				timelineLayer.clipHeight(stage.height());
				
				// Update divider height
				const divider = dividerLayer.children[0] as Rect;
				if (divider) {
					divider.height(stage.height());
				}
				
				renderTimeline();
			}
		};

		// Use ResizeObserver for better responsiveness to container size changes
		const resizeObserver = new ResizeObserver(() => {
			handleResize();
		});

		resizeObserver.observe(container);

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			resizeObserver.disconnect();
		};
	});

	// Re-render when events or threads change
	$: if (stage && labelLayer && timelineLayer && events.length > 0) {
		renderTimeline();
	}

	onDestroy(() => {
		if (stage) {
			stage.destroy();
		}
	});
</script>

<div bind:this={container} class="w-full h-full bg-white border border-gray-200 rounded-md"></div>