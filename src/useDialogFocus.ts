import { useEffect, type RefObject } from "react";

export function useDialogFocus(
  open: boolean,
  modalRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open || !modalRef.current) return;
    const modal = modalRef.current;
    const backgrounds = Array.from(
      document.querySelectorAll<HTMLElement>(".sidebar, .main-shell"),
    );
    const inertBefore = backgrounds.map((el) => el.inert);
    const overflowBefore = document.body.style.overflow;
    backgrounds.forEach((el) => {
      el.inert = true;
    });
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        event.preventDefault();
        modal.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!modal.contains(event.target as Node)) focusable()[0]?.focus();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      backgrounds.forEach((el, i) => {
        el.inert = inertBefore[i];
      });
      document.body.style.overflow = overflowBefore;
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [open, modalRef, triggerRef]);
}
