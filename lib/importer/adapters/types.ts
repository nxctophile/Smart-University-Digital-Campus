export type ParsedRow = Record<string, string>;

export type ParsedFile = {
  columns: string[];
  rows: ParsedRow[];
};

/**
 * Every legacy source - a flat file today, a live database or REST API
 * tomorrow - implements this one interface. The importer, mapping UI and
 * validation pipeline downstream never know which adapter produced the
 * rows.
 */
export interface ImporterAdapter {
  readonly format: string;
  parse(buffer: Buffer): Promise<ParsedFile>;
}
