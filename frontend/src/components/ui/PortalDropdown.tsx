import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * A search-results/combobox popover rendered via a portal to document.body
 * with `position: fixed`, computed from the anchor's live bounding rect.
 * Any ancestor `overflow-hidden` (the shared Card component sets this on
 * its root, and most search fields live inside one) would otherwise clip a
 * plain `position: absolute` dropdown invisible even though its data
 * loaded fine — portaling escapes that clipping entirely.
 */
export function PortalDropdown({
  anchorRef,
  open,
  onClose,
  children,
  minWidth = 280,
}: {
  anchorRef: RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
}) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setRect(null);
      return;
    }
    const update = () => {
      const r = anchorRef.current!.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      // The dropdown is portaled to document.body, so it's never a DOM
      // descendant of anchorRef — without also excluding dropdownRef here,
      // every click on a result reads as "outside" and closes (unmounts)
      // the dropdown on mousedown, before the result's click handler ever
      // gets to fire.
      if (anchorRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onClose, anchorRef]);

  if (!open || !rect) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, minWidth) }}
      className="z-50 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl thin-scroll dark:border-navy-700 dark:bg-navy-900"
    >
      {children}
    </div>,
    document.body
  );
}
