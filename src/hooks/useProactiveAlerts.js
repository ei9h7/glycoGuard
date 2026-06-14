import { useMemo } from "react";
import { usePatterns } from "./usePatterns";

const LOOKAHEAD_HOURS = 1;

function fmtHour(h) {
  const period = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
}

/**
 * Surfaces a proactive heads-up when the current time is approaching (or inside)
 * a recurring low-glucose window previously detected by the pattern engine.
 */
export function useProactiveAlerts() {
  const { patterns, loading } = usePatterns();

  const alert = useMemo(() => {
    if (loading) return null;

    const lowWindowPattern = patterns.find(
      p => p.category === "glucose" && Array.isArray(p.meta?.riskHours) && p.meta.riskHours.length
    );
    if (!lowWindowPattern) return null;

    const now = new Date();
    const currentHour = now.getHours();

    const match = lowWindowPattern.meta.riskHours.find(({ hour }) => {
      const diff = (hour - currentHour + 24) % 24;
      return diff <= LOOKAHEAD_HOURS;
    });
    if (!match) return null;

    const isNow = match.hour === currentHour;
    return {
      title: isNow ? "Reactive window — happening now" : "Reactive window approaching",
      body: isNow
        ? `Glucose has dipped low around ${fmtHour(match.hour)} on ${match.pct}% of recent days. Consider checking in or offering a snack.`
        : `Glucose has historically dipped low around ${fmtHour(match.hour)} (${match.pct}% of recent days). A preemptive snack may help.`,
    };
  }, [patterns, loading]);

  return { alert };
}
