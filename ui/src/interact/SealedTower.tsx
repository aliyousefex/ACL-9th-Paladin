import site from "../data/site.json";

const SOURCE: Record<string, string> = {
  "Finishing position": "results",
  "Points scored today": "results",
  "Laps completed": "results",
  "Status and retirement reason": "status",
  "Pit stops": "pit_stops",
  "Fastest lap": "results",
};

export function SealedTower() {
  return (
    <div>
      <p className="max-w-[68ch]">
        Lap times and pit stops are in the raw book. So are today's points, laps, and status. The column is sealed because a value here would be the race telling on itself. No times are shown, because this page does not invent them.
      </p>
      <div className="mt-5 max-w-full overflow-x-auto" role="region" aria-label="Withheld columns table, scrolls sideways on narrow screens" tabIndex={0}>
      <table className="sheet">
        <caption>Columns withheld from the model. The value cell is empty on purpose.</caption>
        <thead>
          <tr>
            <th>Column</th>
            <th>Table</th>
            <th className="num">Value</th>
          </tr>
        </thead>
        <tbody>
          {site.excluded.map((field) => (
            <tr key={field}>
              <td className="text-steel line-through decoration-signal">{field}</td>
              <td>{SOURCE[field] ?? "raw"}</td>
<td className="text-right text-steel">Withheld</td>
          </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
