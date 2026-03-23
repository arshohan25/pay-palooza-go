import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export interface NavItem {
  id: string;
  label: string;
  icon: any;
}

export interface NavGroup {
  label: string;
  pro?: boolean;
  items: NavItem[];
}

function SortableItem({ item }: { item: NavItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${isDragging ? "opacity-50 bg-muted" : "bg-background"}`}
      {...attributes}
    >
      <button type="button" className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground" {...listeners}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="truncate">{item.label}</span>
    </div>
  );
}

function SortableGroup({
  group,
  onItemReorder,
}: {
  group: NavGroup;
  onItemReorder: (groupLabel: string, oldIndex: number, newIndex: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `group-${group.label}` });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = group.items.findIndex((i) => i.id === active.id);
    const newIndex = group.items.findIndex((i) => i.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onItemReorder(group.label, oldIndex, newIndex);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border p-2 space-y-1 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2 px-1 py-1" {...attributes}>
        <button type="button" className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground" {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
        <span className={`text-xs font-bold uppercase tracking-wider ${group.pro ? "text-primary" : "text-muted-foreground"}`}>
          {group.label}
        </span>
      </div>
      <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
        <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5 pl-2">
            {group.items.map((item) => (
              <SortableItem key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface AdminNavReorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroup[];
  defaultGroups: NavGroup[];
  onSave: (groups: NavGroup[]) => void;
}

export default function AdminNavReorder({ open, onOpenChange, groups, defaultGroups, onSave }: AdminNavReorderProps) {
  const [localGroups, setLocalGroups] = useState<NavGroup[]>(() => JSON.parse(JSON.stringify(groups)));

  // Reset local state when sheet opens
  React.useEffect(() => {
    if (open) setLocalGroups(JSON.parse(JSON.stringify(groups)));
  }, [open]);

  const groupSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localGroups.findIndex((g) => `group-${g.label}` === active.id);
    const newIndex = localGroups.findIndex((g) => `group-${g.label}` === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setLocalGroups(arrayMove(localGroups, oldIndex, newIndex));
    }
  };

  const handleItemReorder = (groupLabel: string, oldIndex: number, newIndex: number) => {
    setLocalGroups((prev) =>
      prev.map((g) =>
        g.label === groupLabel ? { ...g, items: arrayMove(g.items, oldIndex, newIndex) } : g,
      ),
    );
  };

  const handleReset = () => {
    setLocalGroups(JSON.parse(JSON.stringify(defaultGroups)));
  };

  const handleSave = () => {
    onSave(localGroups);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 sm:w-96 p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base">Rearrange Navigation</SheetTitle>
          <SheetDescription className="text-xs">Drag groups or items to reorder. Changes persist across sessions.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-3">
          <DndContext sensors={groupSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
            <SortableContext items={localGroups.map((g) => `group-${g.label}`)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 pb-4">
                {localGroups.map((group) => (
                  <SortableGroup key={group.label} group={group} onItemReorder={handleItemReorder} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>
        <Separator />
        <div className="flex items-center gap-2 p-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button size="sm" className="gap-1.5 ml-auto" onClick={handleSave}>
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
