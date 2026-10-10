export const SECTIONS = [
  { id: "decision", label: "Lights" },
  { id: "line", label: "The line" },
  { id: "book", label: "The book" },
  { id: "findings", label: "The trace" },
  { id: "row", label: "The row" },
  { id: "features", label: "The garage" },
  { id: "models", label: "ML lab" },
  { id: "classification", label: "Classification" },
  { id: "cases", label: "Two cars" },
  { id: "limits", label: "Limits" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
