import { useState } from "react";
import { CoverageChart } from "../charts/CoverageChart";
import { HomeChart } from "../charts/HomeChart";
import { Choice } from "../components/Controls";
import { Prose, Section, Takeaway } from "../components/Section";
import site from "../data/site.json";
import { integer, pct } from "../lib/format";

export function Findings() {
  const [year, setYear] = useState(2001);
  const [band, setBand] = useState(site.home[0].band);
  const point = site.coverage.find((row) => row.year === year);
  const selected = site.home.find((row) => row.band === band) ?? site.home[0];
  const early = site.frontRow.overall[0];
  const modern = site.frontRow.overall[1];
  const earlyAll = site.frontRow.allStarters[0];
  const modernAll = site.frontRow.allStarters[1];
  const earlyMedian = site.frontRow.median[0];
  const modernMedian = site.frontRow.median[1];
  const mechEarly = site.mechanical.eras[0];
  const mechModern = site.mechanical.eras[1];

  return (
    <Section id="findings" title="What the races already show">
      <Prose>
        These three questions use the joined tables, before any model. We separate the counts
        from what we are willing to infer. None of the answers is a causal claim.
      </Prose>

      <h3 className="pt-4 text-[1.2rem] font-semibold tracking-[-0.02em]">Qualifying is not there for most of the history</h3>
      <Prose>
        Drag the season. Coverage is the share of driver-race rows with a qualifying position.
        The line is not a smooth rise.
      </Prose>
      <CoverageChart year={year} />
      <label className="block">
        <span className="figure text-[2.4rem]">{year}</span>
        <span className="figure ml-4 text-[2.4rem]">{point ? pct(point.coverage) : ""}</span>
        <span className="ml-3 text-steel">covered</span>
        <input
          className="mt-2"
          type="range"
          min={1950}
          max={2024}
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        />
      </label>
      <Prose>
        It is {pct(coverageAt(1950), 0)} in 1950 and still {pct(coverageAt(1993), 0)} in 1993.
        It jumps to {pct(coverageAt(1994))} in 1994, then falls again. The low point of that
        second gap is {pct(coverageAt(2001))} in 2001. From 2003 the line sits on{" "}
        {pct(coverageAt(2003), 0)}. Across every row, {pct(site.qualifyingMissing)} have no
        qualifying position. We keep the early seasons, store a missingness flag, and treat
        grid position as the starting-order feature that exists throughout.
      </Prose>

      <h3 className="pt-6 text-[1.2rem] font-semibold tracking-[-0.02em]">A front-row start converts far more often</h3>
      <Prose>
        Front row means grid 1 or 2 on the final grid, not qualifying order. A penalty can
        move a car between qualifying and the start. Circuits need at least ten such starts
        in an era to enter the ranking. That leaves {earlyMedian.circuits} circuits before
        2014 and {modernMedian.circuits} from 2014 on.
      </Prose>
      <div className="max-w-full overflow-x-auto">
        <table className="sheet">
          <caption>
            Highest front-row podium rates in each era. The rate is podiums divided by front-row starts.
          </caption>
          <thead>
            <tr>
              <th>Era</th>
              <th>Circuit</th>
              <th className="num">Rate</th>
              <th className="num">Starts</th>
            </tr>
          </thead>
          <tbody>
            {site.frontRow.leaders.map((row) => (
              <tr key={`${row.era}-${row.circuit}`}>
                <td>{row.era}</td>
                <td>{row.circuit}</td>
                <td className="num">{pct(row.rate)}</td>
                <td className="num">{integer(row.starts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Prose>
        The level shifts, not only the leader. The median circuit is {pct(earlyMedian.rate)} before
        2014 and {pct(modernMedian.rate)} after. Using every front-row start, not only circuits
        that pass the ten-start rule, the rate is {pct(early.rate)} of {integer(early.count)} starts
        before 2014, and {pct(modern.rate)} of {integer(modern.count)} after. All starters, not
        just the front row, podium at {pct(earlyAll.rate)} and {pct(modernAll.rate)} in those same
        eras. Istanbul Park and Dijon-Prenois sit near the top of the early list on 14 and 12
        starts. We can say the leaders change. We cannot say a circuit causes the conversion.
        The front row is already the fastest cars.
      </Prose>

      <h3 className="pt-6 text-[1.2rem] font-semibold tracking-[-0.02em]">Inside a grid band, home does not help</h3>
      <Prose>
        Home means the mapped nationality matches the circuit country. Drivers we could not map
        are left out. Choose a band. The chart is the rate. The counts underneath are why a
        small gap is not a finding.
      </Prose>
      <HomeChart />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Grid band">
        {site.home.map((row) => (
          <Choice key={row.band} pressed={row.band === selected.band} onClick={() => setBand(row.band)}>
            {row.band}
          </Choice>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 sm:grid-cols-4">
        <div>
          <dt className="text-steel">Grid</dt>
          <dd className="figure mt-2 text-[2.6rem]">{selected.band}</dd>
        </div>
        <div>
          <dt className="text-steel">Away</dt>
          <dd className="figure mt-2 text-[2.6rem]">{pct(selected.awayRate)}</dd>
          <dd className="mt-2 text-steel">{integer(selected.awayStarts)} starts</dd>
        </div>
        <div>
          <dt className="text-steel">Home</dt>
          <dd className="figure mt-2 text-[2.6rem]">{pct(selected.homeRate)}</dd>
          <dd className="mt-2 text-steel">{integer(selected.homeStarts)} starts</dd>
        </div>
        <div>
          <dt className="text-steel">Gap</dt>
          <dd className="figure mt-2 text-[2.6rem]">{points(selected.gap)}</dd>
          <dd className="mt-2 text-steel">percentage points</dd>
        </div>
      </dl>
      <Prose>
        Away drivers fall from about {pct(site.home[0].awayRate)} at the front of the grid to{" "}
        {pct(site.home[4].awayRate)} from 16th back. Home drivers track that ladder. Four of the
        five gaps are slightly negative. The only positive one is positions 11-15, at{" "}
        {points(site.home[3].gap)} percentage points. In the front band the home
        sample is {integer(site.home[0].homeStarts)} starts against {integer(site.home[0].awayStarts)}{" "}
        away. Compared with the drop from the front to the back, home status does not move a
        driver from one rung to another.
      </Prose>

      <h3 className="pt-6 text-[1.2rem] font-semibold tracking-[-0.02em]">Mechanical retirements fall after 2021</h3>
      <Prose>
        A start counts as mechanical only when the status is on a fixed list of{" "}
        {site.mechanical.statusCount} component failures. Crashes, driver errors, and
        disqualifications are not on it. Cars that did not start are removed from the
        denominator: {site.mechanical.nonStarts.join(", ")}. A constructor needs at least 20
        starts in an era. The rate is failures divided by starts, so a reliable car stays in
        the denominator.
      </Prose>
      <Prose>
        Among those constructors we count {integer(mechEarly.failures)} mechanical retirements
        in {integer(mechEarly.starts)} starts in {mechEarly.era} ({pct(mechEarly.rate)}), and{" "}
        {integer(mechModern.failures)} in {integer(mechModern.starts)} starts in {mechModern.era}{" "}
        ({pct(mechModern.rate)}). The median constructor falls from {pct(mechEarly.median)} to{" "}
        {pct(mechModern.median)}. The table shows both ends, because a list of only the worst
        rates makes an era look less reliable than it is.
      </Prose>
      <div className="max-w-full overflow-x-auto">
        <table className="sheet">
          <caption>High and low mechanical-retirement rates, plus a few large teams for scale.</caption>
          <thead>
            <tr>
              <th>Era</th>
              <th>Constructor</th>
              <th className="num">Rate</th>
              <th className="num">Failures</th>
              <th className="num">Starts</th>
            </tr>
          </thead>
          <tbody>
            {site.mechanical.rows.map((row) => (
              <tr key={`${row.era}-${row.constructor}`}>
                <td>{row.era}</td>
                <td>{row.constructor}</td>
                <td className="num">{pct(row.rate)}</td>
                <td className="num">{integer(row.failures)}</td>
                <td className="num">{integer(row.starts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Prose>
        Caterham leads 2014-2021 at {pct(rateOf("2014-2021", "Caterham"))}, which is 8 failures
        in 34 starts. Mercedes, over 320 starts, sits at {pct(rateOf("2014-2021", "Mercedes"))}.
        Alfa Romeo is {pct(rateOf("2014-2021", "Alfa Romeo"))} in the first era and{" "}
        {pct(rateOf("2022-2024", "Alfa Romeo"))} in the second. The same name is not the same
        car, and this table does not say why the rate rose. One reading of the era drop is the
        2022 regulation change. The status list can move the rate as well, so we stop at the
        comparison.
      </Prose>
      <Takeaway>
        The grid sorts podium rates into a steep ladder. Qualifying cannot be followed from
        1950. Home nationality, measured this way, does not add a consistent extra rate.
        Mechanical failures, under our list, are less common in 2022-2024, and the highest
        rates rest on fewer starts than the works teams.
      </Takeaway>
    </Section>
  );
}

function points(gap: number): string {
  const value = gap * 100;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function coverageAt(year: number): number {
  return site.coverage.find((row) => row.year === year)?.coverage ?? 0;
}

function rateOf(era: string, name: string): number {
  return site.mechanical.rows.find((row) => row.era === era && row.constructor === name)?.rate ?? 0;
}
