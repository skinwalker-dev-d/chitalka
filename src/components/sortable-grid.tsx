"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Long-press hook ────────────────────────────────────────────────────────

const LONG_PRESS_MS = 2000;

export function useLongPress(onActivate: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);

  const start = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button[role='menuitem'], .book-action-menu, .shelf-actions, .collection-actions")) return;
      setPressing(true);
      timerRef.current = setTimeout(() => {
        setPressing(false);
        onActivate();
      }, LONG_PRESS_MS);
    },
    [onActivate]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setPressing(false);
  }, []);

  return { start, cancel, pressing };
}

// ─── Sortable item wrapper ───────────────────────────────────────────────────

export function SortableItem({
  id,
  isEditMode,
  children,
}: {
  id: string;
  isEditMode: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isEditMode,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.3 : 1,
      }}
      className={isEditMode ? "sortable-item sortable-item--edit" : "sortable-item"}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      {children}
    </div>
  );
}

// ─── Sortable grid ───────────────────────────────────────────────────────────

export function SortableGrid<T extends { id: string }>({
  items,
  onReorder,
  isEditMode,
  onEnterEditMode,
  renderItem,
  renderDragOverlay,
  className,
  containerStyle,
}: {
  items: T[];
  onReorder: (newItems: T[]) => void;
  isEditMode: boolean;
  onEnterEditMode: () => void;
  renderItem: (item: T, isEditMode: boolean) => React.ReactNode;
  renderDragOverlay?: (item: T) => React.ReactNode;
  className?: string;
  containerStyle?: React.CSSProperties;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { start: lpStart, cancel: lpCancel, pressing } = useLongPress(onEnterEditMode);

  // Block swipe-to-navigate while reordering so drags aren't hijacked by the browser gesture
  useEffect(() => {
    const prev = document.body.style.overscrollBehaviorX;
    if (isEditMode) {
      document.body.style.overscrollBehaviorX = "none";
    }
    return () => { document.body.style.overscrollBehaviorX = prev; };
  }, [isEditMode]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === String(active.id));
    const newIndex = items.findIndex((i) => i.id === String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) onReorder(arrayMove(items, oldIndex, newIndex));
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div
          className={`${className ?? "collection-page-grid"}${pressing ? " grid-long-pressing" : ""}${isEditMode ? " grid-is-editing" : ""}`}
          style={isEditMode ? { touchAction: "none", ...containerStyle } : containerStyle}
          onPointerDown={!isEditMode ? lpStart : undefined}
          onPointerUp={!isEditMode ? lpCancel : undefined}
          onPointerCancel={!isEditMode ? lpCancel : undefined}
          onPointerLeave={!isEditMode ? lpCancel : undefined}
        >
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id} isEditMode={isEditMode}>
              {renderItem(item, isEditMode)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div className="sortable-drag-overlay">
            {renderDragOverlay ? renderDragOverlay(activeItem) : renderItem(activeItem, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
