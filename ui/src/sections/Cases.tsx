import { CARS, type CarPhoto } from "../components/CarFrame";
import site from "../data/site.json";
import { featureLabel, num, pct } from "../lib/format";
import { Prose, Section, Takeaway } from "../components/Section";

export function Cases() {
  const hamilton = site.hamilton;
  const partial = site.partial;
  const russell = site.russell;
  const logistic = site.logistic;
  const front = site.home[0];
  const rows = logistic.local.rows.slice().sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 6);
  const maxLog = Math.max(...rows.map((row) => Math.abs(row.contribution)));

  return (
    <Section id="cases" title="Real rows, and one that is not">
      <Prose>
        The scores are from the selected logistic regression, cutoff {num(hamilton.threshold)}. The signed log-odds bars below are that same
        model decomposed exactly. The forest bars at the end are a cross-check on a different question. We do not mix those claims.
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
            <Fact label="Points before" value={String(hamilton.driverPoints)} />
          </dl>
          <CutoffMark probability={hamilton.probability} threshold={hamilton.threshold} />
          <p className="mt-4">
            His previous five starts in this table were all podiums. It was round 1, so no points had been scored yet. The model
            scores him{" "}
            <span className="figure text-[1.7rem]">{num(hamilton.probability)}</span>, above {num(hamilton.threshold)}, so the predicted
            label is a podium. {hamilton.podium === 1 ? "He finished third." : "He did not finish on the podium."} A fifth-place start backed by a
            perfect recent run was enough to lift him over the cutoff, in the race and in the model.
          </p>
          <CarCredit photo={CARS.mercedes} />
        </div>
      </article>

      <article className="border border-line p-4">
        <h3 className="font-medium">A typed-in row, not a start</h3>
        <p className="mt-2">
          Grid {partial.grid}, not a pit-lane start, not a front-row flag, field of {partial.field}, season {partial.year}. Every other
          feature is missing and is replaced with the training median. The model returns{" "}
          <span className="figure text-[1.7rem]">{num(partial.probability)}</span>, below the cutoff. This row has no true result.
        </p>
        <CutoffMark probability={partial.probability} threshold={partial.threshold} />
        <p className="mt-3">
          Do not read {num(partial.probability)} as the historical podium rate of cars that start third. Positions 1-3 podium at{" "}
          {pct(front.awayRate)} away and {pct(front.homeRate)} at home. The partial row is a third-place start glued onto a median
          historical driver, and the median driver in a 1950-2019 training set is not a podium contender. The low number shows that the
          imputer accepts a half-empty row. It is not a base rate.
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
            {russell.driver}, {russell.constructor}: one row, two explanations
          </h3>
          <p className="mt-1 text-steel">
            {russell.race}, {russell.year}. Grid {russell.grid}, championship rank {russell.rank}, recent podium rate{" "}
            {num(russell.podiumRate, 1)}. Result: {russell.podium === 1 ? "podium" : "not a podium"}.
          </p>

          <h4 className="mt-5 font-medium">The selected logistic regression, exactly</h4>
          <p className="mt-1 max-w-[68ch] text-steel">
            Each bar is the standardised input times its weight, in log-odds. With the intercept ({num(logistic.intercept)}) they sum to{" "}
            {num(logistic.local.totalLogOdds)}, which is a score of {num(logistic.local.probability)}, well below the cutoff.
          </p>
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <Signed key={row.feature} label={featureLabel(row.feature)} observed={row.observed} value={row.contribution} max={maxLog} digits={3} />
            ))}
          </ul>

          <h4 className="mt-7 font-medium">The random forest, as a cross-check</h4>
          <p className="mt-1 max-w-[68ch] text-steel">
            SHAP values for the forest on the same row. They describe the forest, not the selected model, and they need not agree with the
            weights above.
          </p>
          <ul className="mt-4 space-y-3">
            {russell.shap.map((row) => (
              <Signed
                key={row.feature}
                label={featureLabel(row.feature)}
                observed={row.observed}
                value={row.value}
                max={Math.max(...russell.shap.map((item) => Math.abs(item.value)))}
                digits={3}
              />
            ))}
          </ul>
          <p className="mt-4 text-quiet">
            The two lists differ: the logistic model's largest single push is the season (year), the forest's is the grid slot. Different models lean on the inputs differently, and neither list is a causal claim.
          </p>
          <CarCredit photo={CARS.williams} />
        </div>
      </article>

      <Takeaway>
        On a real 2022 row, the selected model put a fifth-place start with a perfect recent podium run above its cutoff, and the driver finished
        third. The typed-in row is an imputed profile, not a base rate. The Russell bars are one validation row explained twice: exactly for the
        logistic model, and by SHAP for the forest.
      </Takeaway>
    </Section>
  );
}

function Signed({ label, observed, value, max, digits }: { label: string; observed: number; value: number; max: number; digits: number }) {
  const width = `${(Math.abs(value) / max) * 100}%`;
  return (
    <li>
      <span className="flex items-baseline justify-between gap-4">
        <span>
          {label}
          <span className="ml-2 text-steel">{num(observed, observed >= 10 ? 0 : 1)}</span>
        </span>
        <span className={`figure text-[1.45rem] ${value < 0 ? "text-signal-text" : "text-ink"}`}>
          {`${value > 0 ? "+" : ""}${value.toFixed(digits)}`}
        </span>
      </span>
      <span className="mt-1 grid grid-cols-2 gap-2">
        <span className="flex justify-end">{value < 0 && <span className="block h-1.5 bg-signal" style={{ width }} />}</span>
        <span>{value > 0 && <span className="block h-1.5 bg-ink" style={{ width }} />}</span>
      </span>
    </li>
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
        aria-label={`Podium score ${num(probability)} against cutoff ${num(threshold)}`}
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
