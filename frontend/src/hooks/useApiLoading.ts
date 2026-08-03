import { useEffect, useState } from "react";

export function useApiLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleApiLoading(event: Event) {
      const detail = (event as CustomEvent<{ isLoading?: boolean }>).detail;
      setIsLoading(Boolean(detail?.isLoading));
    }

    window.addEventListener("api-loading", handleApiLoading);
    return () => window.removeEventListener("api-loading", handleApiLoading);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      const doneTimer = window.setTimeout(() => setProgress(0), 220);
      return () => window.clearTimeout(doneTimer);
    }

    setProgress(12);
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current < 55) return current + 7;
        if (current < 78) return current + 3;
        if (current < 92) return current + 1;
        return current;
      });
    }, 240);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  return { isLoading, progress };
}
