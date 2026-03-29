import { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; type: ToastType; duration: number };

let toastId = 0;

// Shared state via module-level subscribers (avoids context provider)
const subscribers = new Set<(toast: ToastItem) => void>();

export function showToast(message: string, type: ToastType = 'success', duration = 5000) {
  const toast: ToastItem = { id: ++toastId, message, type, duration };
  subscribers.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setToasts((prev) => [...prev, toast]);
      if (toast.duration > 0) {
        const timer = setTimeout(() => dismiss(toast.id), toast.duration);
        timers.current.set(toast.id, timer);
      }
    };
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-md shadow-lg text-sm min-w-[280px] max-w-[480px]',
            toast.type === 'success' && 'bg-foreground text-background',
            toast.type === 'error' && 'bg-destructive text-white',
            toast.type === 'info' && 'bg-muted text-foreground border border-border'
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
