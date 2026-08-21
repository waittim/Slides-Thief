import React from "react";
import type { LocaleCopy } from "../i18n";
import type { SlideItem } from "../lib/types";
import { Button, CountBadge } from "./ui";

interface InspectorPanelProps {
  inspectorCollapsed: boolean;
  setInspectorCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  text: LocaleCopy;
  readySlides: SlideItem[];
  metrics: Array<[string, string]>;
  selectedSlide: SlideItem | null;
  workerError: string;
}

export function InspectorPanel({
  inspectorCollapsed,
  setInspectorCollapsed,
  text,
  readySlides,
  metrics,
  selectedSlide,
  workerError,
}: InspectorPanelProps) {
  return (
    <aside className={`inspector ${inspectorCollapsed ? "collapsed" : ""}`}>
      <div className="sectionHead">
        <h2>{text.details}</h2>
        <CountBadge count={readySlides.length} />
        <Button
          variant="icon"
          size="sm"
          className="inspectorToggle"
          type="button"
          title={inspectorCollapsed ? text.expand : text.collapse}
          aria-label={inspectorCollapsed ? text.expand : text.collapse}
          aria-expanded={!inspectorCollapsed}
          aria-controls="inspectorDetails"
          onClick={() => setInspectorCollapsed((value) => !value)}
        >
          {inspectorCollapsed ? "+" : "−"}
        </Button>
      </div>
      <div className="inspectorBody" id="inspectorDetails">
        <div className="metrics">
          {metrics.map(([key, value]) => (
            <div className="metric" key={key}>
              <div className="key">{key}</div>
              <div className="value">{value}</div>
            </div>
          ))}
        </div>
        <div className="cornerTable">
          {selectedSlide?.quad
            ? selectedSlide.quad.map(([x, y], index) => (
                <div className="cornerRow" key={index}>
                  <span>{index + 1}</span>
                  <code>{Math.round(x * 100) / 100}</code>
                  <code>{Math.round(y * 100) / 100}</code>
                </div>
              ))
            : null}
        </div>
        {workerError ? <p className="errorText" role="alert">{workerError}</p> : null}
        {selectedSlide?.error ? <p className="errorText" role="alert">{selectedSlide.error.message}</p> : null}
      </div>
    </aside>
  );
}
