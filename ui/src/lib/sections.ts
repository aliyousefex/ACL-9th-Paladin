export const SECTIONS = [
  { id: "decision", label: "The decision" },
  { id: "book", label: "The book" },
  { id: "findings", label: "What the races show" },
  { id: "row", label: "How a row is built" },
  { id: "features", label: "Seventeen inputs" },
  { id: "models", label: "Three models" },
  { id: "classification", label: "The classification" },
  { id: "cases", label: "Case files" },
  { id: "limits", label: "Limits" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
