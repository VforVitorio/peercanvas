/**
 * Minimal stroke glyphs authored for this demo (simple lines/rectangles, no external
 * icon set or downloaded artwork). Always decorative: controls carry their own names.
 */
const paths = {
  undo: "M5 6H11a3 3 0 010 6H8M5 6l3-3M5 6l3 3",
  redo: "M11 6H5a3 3 0 000 6h3M11 6L8 3M11 6l-3 3",
  rect: "M3 4h10v8H3z",
  text: "M4 4h8M8 4v9M6 13h4",
  connect: "M3 12L13 4M13 4H9M13 4v4",
  trash: "M4 5h8M6 5V3h4v2M5 5l1 8h4l1-8",
  plus: "M8 3v10M3 8h10",
  minus: "M3 8h10",
  home: "M3 8l5-5 5 5M5 7v6h6V7",
  panelLeft: "M3 3h10v10H3zM7 3v10",
  panelRight: "M3 3h10v10H3zM9 3v10",
  search: "M7 3a4 4 0 110 8 4 4 0 010-8zM10 10l3 3",
  fit: "M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3",
  sun: "M8 5a3 3 0 110 6 3 3 0 010-6zM8 1v2M8 13v2M1 8h2M13 8h2",
  moon: "M11 10A5 5 0 016 4a5 5 0 105 6z",
  help: "M6 6a2 2 0 114 0c0 1.5-2 1.5-2 3M8 12v.5",
  chat: "M3 4h10v6H7l-3 3v-3H3z",
  people: "M6 7a2 2 0 100-4 2 2 0 000 4zM2 13a4 4 0 018 0M11 7a2 2 0 100-4M12 13h2a4 4 0 00-3-4",
  sliders: "M3 5h10M3 11h10M6 3v4M10 9v4",
  history: "M3 8a5 5 0 105-5M3 3v3h3M8 5v3l2 2",
  save: "M3 3h8l2 2v8H3zM5 3v4h5V3M5 13v-3h6v3",
  reset: "M4 8a4 4 0 107-2.6M11 2v3H8",
} as const;

export type IconName = keyof typeof paths;

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg className="pc-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
