import { CARS, type CarPhoto } from "../components/CarFrame";
import site from "../data/site.json";
import { featureLabel, num, pct } from "../lib/format";
import { Prose, Section, Takeaway } from "../components/Section";

export function Cases() {
  const hamilton = site.hamilton;
  const partial = site.partial;
  const russell = site.russell;
  const front = site.home[0];

  return (
    <Section id="cases" title="Two real rows, and one that is not">
      <Prose>
        The probabilities are the shallow neural network, cutoff {num(hamilton.threshold)}.
        The signed bars are the forest, on a different row. We do not mix those two claims.
      </Prose>

      <article className="border border-ink">
        <img
          src={CARS.mercedes.src}
          alt={CARS.mercedes.alt}
          width={1600}
          height={1000}
          loading="lazy"
          decoding="async"
          className="aspect-[16/8] w-full object-cover object-[center_62%]"
        />
        <div className="p-4">
        <h3 className="font-medium">
          {hamilton.driver}, {hamilton.constructor}
        </h3>
        <p className="mt-1 text-steel">
          {hamilton.race}, {hamilton.year}, round {hamilton.round}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          <Fact label="Grid" value={String(hamilton.grid)} />
          <Fact label="Qualifying" value={String(hamilton.qualifying)} />
          <Fact label="Field" value={String(hamilton.field)} />
          <Fact label="Driver form" value={num(hamilton.driverForm, 1)} />
          <Fact label="Team form" value={num(hamilton.constructorForm, 1)} />
          <Fact label="Championship rank" value={String(hamilton.driverRank)} />
        </dl>
        <CutoffMark probability={hamilton.probability} threshold={hamilton.threshold} />
        <p className="mt-4">
          His previous five starts in this table were all podiums. Mercedes sat{" "}
          {ordinal(hamilton.constructorRank)} in the constructors' table. The network scores{" "}
          <span className="figure text-[1.7rem]">{num(hamilton.probability)}</span>, below {num(hamilton.threshold)},
          so the predicted label is not a podium. The result was not a podium. Recent form did
          not overcome 15th on the grid, in the race or in the model.
        </p>
        <CarCredit photo={CARS.mercedes} />
        </div>
      </article>

      <article className="border border-line p-4">
        <h3 className="font-medium">A typed-in row, not a start</h3>
        <p className="mt-2">
          Grid {partial.grid}, not a pit-lane start, not a front-row flag, field of {partial.field},
          season {partial.year}, round {partial.round}. Every other feature is missing and is
          replaced with the training median. The network returns{" "}
          <span className="figure text-[1.7rem]">{num(partial.probability)}</span>, also below the cutoff.
          This row has no true result.
        </p>
        <CutoffMark probability={partial.probability} threshold={partial.threshold} />
        <p className="mt-3">
          Do not read {num(partial.probability)} as the historical podium rate of cars that
          start third. Positions 1-3 podium at {pct(front.awayRate)} away and {pct(front.homeRate)}{" "}
          at home. The partial row is a third-place start glued onto a median historical
          driver, and the median driver in a 1950-2019 training set is not a podium contender.
          The low number shows that the imputer accepts a half-empty row. It is not a base rate.
        </p>
      </article>

      <article className="border border-line">
        <img
          src={CARS.williams.src}
          alt={CARS.williams.alt}
          width={1600}
          height={1000}
          loading="lazy"
          decoding="async"
          className="aspect-[16/8] w-full object-cover"
        />
        <div className="p-4">
        <h3 className="font-medium">
          {russell.driver}, {russell.constructor}
        </h3>
        <p className="mt-1 text-steel">
          {russell.race}, {russell.year}. Forest explanation, not the network. Grid {russell.grid},
          championship rank {russell.rank}, recent podium rate {num(russell.podiumRate, 1)}. Result:{" "}
          {russell.podium === 1 ? "podium" : "not a podium"}.
        </p>
        <ul className="mt-4 space-y-3">
          {russell.shap.map((row) => {
            const max = Math.max(...russell.shap.map((item) => Math.abs(item.value)));
            const width = `${(Math.abs(row.value) / max) * 100}%`;
            return (
              <li key={row.feature}>
                <span className="flex items-baseline justify-between gap-4">
                  <span>
                    {featureLabel(row.feature)}
                    <span className="ml-2 text-steel">{num(row.observed, row.observed >= 10 ? 0 : 1)}</span>
                  </span>
                  <span className={`figure text-[1.45rem] ${row.value < 0 ? "text-signal" : "text-ink"}`}>
                    {`${row.value > 0 ? "+" : ""}${row.value.toFixed(3)}`}
                  </span>
                </span>
                <span className="mt-1 grid grid-cols-2 gap-2">
                  <span className="flex justify-end">
                    {row.value < 0 && <span className="block h-1.5 bg-signal" style={{ width }} />}
                  </span>
                  <span>{row.value > 0 && <span className="block h-1.5 bg-ink" style={{ width }} />}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-quiet">
          The largest push is grid position {russell.grid}, and it is negative. Recent form
          pushes the other way, and it is smaller. One validation row, drawn from the fixed
          sample, not picked because it looks tidy.
        </p>
        <CarCredit photo={CARS.williams} />
        </div>
      </article>

      <Takeaway>
        On a real 2022 row, the selected model stayed below its cutoff for a 15th-place start
        despite a perfect recent podium run. The synthetic row is an imputed profile. The
        Russell bars describe the forest.
      </Takeaway>
    </Section>
  );
}

function CarCredit({ photo }: { photo: CarPhoto }) {
  return (
    <p className="mt-4 text-[0.92rem] leading-snug text-steel">
      {photo.detail}{" "}
      <a href={photo.creditHref} className="underline decoration-line underline-offset-[3px] hover:text-ink">
        {photo.credit}
      </a>
      {", "}
      <a href={photo.licenseHref} className="underline decoration-line underline-offset-[3px] hover:text-ink">
        {photo.license}
      </a>
      .
    </p>
  );
}

function CutoffMark({ probability, threshold }: { probability: number; threshold: number }) {
  return (
    <div className="mt-5">
      <div
        className="relative h-8"
        role="img"
        aria-label={`Network probability ${num(probability)} against cutoff ${num(threshold)}`}
      >
        <span className="absolute top-3 right-0 left-0 h-px bg-line" />
        <span className="absolute top-1 h-5 w-px bg-ink" style={{ left: `${threshold * 100}%` }} />
        <span className="absolute top-1.5 h-3 w-3 -translate-x-1/2 bg-signal" style={{ left: `${probability * 100}%` }} />
      </div>
      <p className="flex justify-between text-[0.95rem] text-steel">
        <span>0</span>
        <span>Red mark {num(probability)}. Cutoff {num(threshold)}.</span>
        <span>1</span>
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-steel">{label}</dt>
      <dd className="figure mt-1 text-[2.2rem]">{value}</dd>
    </div>
  );
}

function ordinal(value: number): string {
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}
