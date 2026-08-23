import { useEffect, useState } from "react";

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const TICK_MS = 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];

export function useSessionTimeout(isActive: boolean, onTimeout: () => void) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setSecondsRemaining(null);
      return;
    }

    let timeoutTimer = window.setTimeout(onTimeout, SESSION_TIMEOUT_MS);
    let warningTimer = window.setTimeout(() => {
      setSecondsRemaining(WARNING_MS / TICK_MS);
      startCountdown();
    }, SESSION_TIMEOUT_MS - WARNING_MS);
    let tickTimer: number | undefined;

    function startCountdown() {
      window.clearInterval(tickTimer);
      tickTimer = window.setInterval(() => {
        setSecondsRemaining((current) => {
          if (!current || current <= 1) return current;
          return current - 1;
        });
      }, TICK_MS);
    }

    function resetTimer() {
      window.clearTimeout(timeoutTimer);
      window.clearTimeout(warningTimer);
      window.clearInterval(tickTimer);
      setSecondsRemaining(null);
      timeoutTimer = window.setTimeout(onTimeout, SESSION_TIMEOUT_MS);
      warningTimer = window.setTimeout(() => {
        setSecondsRemaining(WARNING_MS / TICK_MS);
        startCountdown();
      }, SESSION_TIMEOUT_MS - WARNING_MS);
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    return () => {
      window.clearTimeout(timeoutTimer);
      window.clearTimeout(warningTimer);
      window.clearInterval(tickTimer);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [isActive, onTimeout]);

  return {
    secondsRemaining,
    staySignedIn: () => setSecondsRemaining(null)
  };
}
