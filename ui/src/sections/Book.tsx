import site from "../data/site.json";
import { integer } from "../lib/format";
import { Prose, Section, Takeaway } from "../components/Section";

export function Book() {
  return (
    <Section id="book" title="The book of tables">
      <Prose>
        The raw files are the fourteen Kaggle/Ergast tables for 1950-2024. We do not edit them.
        The literal value \N is read as missing. Dates become dates, and a qualifying time such
        as 1:25.187 becomes seconds.
      </Prose>
      <Prose>
        We audited {site.audit.tables} primary keys covering {integer(site.audit.rows)} rows.
        Null keys: {site.audit.nullKeys}. Duplicate keys: {site.audit.duplicateKeys}. We then
        checked {site.audit.foreignKeys} foreign-key relationships, {integer(site.audit.checked)}{" "}
        child rows in all. Orphans: {site.audit.orphans}. A result row points at a real race,
        driver, constructor, and status. A race points at a real circuit.
      </Prose>
      <div className="max-w-full overflow-x-auto">
        <table className="sheet">
          <caption>Audited tables and how many rows each primary key covers.</caption>
          <thead>
            <tr>
              <th>Table</th>
              <th className="num">Rows</th>
            </tr>
          </thead>
          <tbody>
            {site.tableCounts.map((row) => (
              <tr key={row.table}>
                <td>{row.table}</td>
                <td className="num">{integer(row.rows)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Prose>
        Results start with {integer(site.diagnostics.raw_result_rows)} rows, but that is not yet
        one row per driver per race. Early shared drives produce {site.diagnostics.duplicate_driver_race_groups}{" "}
        driver-race groups with more than one result. We keep one row, in this order: a car that
        actually started (grid greater than 0), then the better finish, then the smaller result
        id. {integer(site.diagnostics.clean_rows)} rows remain, and each pair of race and driver
        appears once. Grid position 0 is a pit-lane start, {pctSafe(site.pitLaneShare)} of rows.
        We keep that as a flag and treat the numeric grid as missing, so the model cannot learn
        that 0 is better than pole.
      </Prose>
      <Takeaway>
        The joins hold, and the modelling grain is one driver in one race. Lap times and pit
        stops stay in the raw book. They are not features.
      </Takeaway>
    </Section>
  );
}

function pctSafe(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
