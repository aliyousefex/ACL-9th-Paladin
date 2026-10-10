import { FormWindow } from "../interact/FormWindow";
import site from "../data/site.json";
import { integer, pct } from "../lib/format";
import { Prose, Section, Takeaway } from "../components/Section";

const STEPS = [
  {
    title: "Two rows become one",
    body: "A shared drive can leave two results for the same driver in the same race. We keep the car that started, then the better finish, then the smaller result id.",
  },
  {
    title: "Grid 0 stops pretending to be pole",
    body: "A zero on the grid becomes a pit-lane flag. The numeric position is left missing.",
  },
  {
    title: "Standings hop forward one race",
    body: "A standings row describes the table after a race. We attach it to the next race in that season, so the current result is not inside the current features.",
  },
  {
    title: "Form shifts before it rolls",
    body: "The previous five podiums are computed after a shift. Constructor form is averaged across both cars first, so one teammate cannot see the other teammate's result from the same race.",
  },
  {
    title: "The seasons are cut, not shuffled",
    body: "Training is through 2019. Validation is 2020-2021. The test seasons, 2022-2024, are scored once. A random split would let 2023 teach the model about 2022.",
  },
];

export function Build() {
  const validation = site.splits.find((row) => row.name === "Validation");
  return (
    <Section id="row" title="How one row is built">
      <Prose>
        The descriptive results already point at the grid. The modelling step has to respect
        the cutoff. These are the operations that keep today's result out of today's inputs.
      </Prose>
      <ol className="space-y-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-3">
            <span className="font-mono text-[13px] text-steel">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-quiet">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="pt-4 text-[1.7rem]">The five-race window</h3>
      <FormWindow />
      <div className="max-w-full overflow-x-auto">
        <table className="sheet">
          <caption>The time split. Starters per race is modelling rows divided by races.</caption>
          <thead>
            <tr>
              <th>Split</th>
              <th>Seasons</th>
              <th className="num">Rows</th>
              <th className="num">Races</th>
              <th className="num">Podiums</th>
              <th className="num">Qualifying missing</th>
            </tr>
          </thead>
          <tbody>
            {site.splits.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.seasons}</td>
                <td className="num">{integer(row.rows)}</td>
                <td className="num">{integer(row.races)}</td>
                <td className="num">{pct(row.podiumRate)}</td>
                <td className="num">{pct(row.qualifyingMissing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {validation && (
        <Prose>
          Validation is {integer(validation.races)} races and {integer(validation.rows)} rows.
          That window can separate a large gap from a small one. It cannot rank effects of a
          few thousandths. Training averages {site.splits[0].startersPerRace.toFixed(1)} starters
          per race, against {validation.startersPerRace.toFixed(1)} later, which is why the
          podium rate rises from {pct(site.splits[0].podiumRate)} to {pct(validation.podiumRate)}.
          There are still three podium places, shared across fewer cars. Qualifying is missing
          on {pct(site.splits[0].qualifyingMissing)} of training rows and almost never in the
          recent splits.
        </Prose>
      )}
      <Takeaway>
        The features are pre-race by construction. The training years are a different problem
        from 2020-2024: more missing qualifying, larger fields, and a lower podium rate.
      </Takeaway>
    </Section>
  );
}
