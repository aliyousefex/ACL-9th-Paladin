import { Prose, Section } from "../components/Section";
import site from "../data/site.json";
import { integer, pct } from "../lib/format";

export function Limits() {
  return (
    <Section id="limits" title="What this does not say">
      <Prose>
        Qualifying coverage is a property of this snapshot. The chart does not tell us how
        much of the pre-1994 gap is the sport and how much is the way the public tables were
        filled.
      </Prose>
      <Prose>
        Constructor identifiers reset when a team is renamed. Form and standings for the new
        name start again. A works team that changes its entry looks like a new constructor.
      </Prose>
      <Prose>
        The home analysis depends on a nationality map. Unmapped drivers are excluded, and
        more than one sporting nationality is forced into one label. The front-band home
        sample is small enough that a one-point gap is not a precise estimate.
      </Prose>
      <Prose>
        The mechanical list is a rule we wrote down, not a measurement from the car.
        Ambiguous statuses can fall outside it. Leading rates such as Caterham's rest on a
        few dozen starts. The lower 2022-2024 totals are consistent with a more reliable
        field, and also with changes in how retirements were described.
      </Prose>
      <Prose>
        Validation is {site.splits[1].races} races. We used it to pick a cutoff and a model.
        We do not pretend it can rank effects of a few thousandths. The models associate
        historical patterns. They do not say what would happen if a car started one place
        further forward, and a probability is not a guarantee about the next race.
      </Prose>
      <Prose>
        What the evidence supports is narrower, and enough. After{" "}
        {site.diagnostics.duplicate_driver_race_groups} shared-drive groups are resolved,{" "}
        {integer(site.diagnostics.clean_rows)} rows remain, {pct(site.podiumRate)} of them
        podiums. The grid carries the description, the ablation, and both forest explanations.
        The network is the model the validation score selects, and the test seasons still
        place it slightly first. The three models are close enough that validation cannot rank them.
      </Prose>
      <p className="text-steel">
        Paladin. Numbers on this page are exported from the analysis artifacts, the same run
        as the written report.
      </p>
    </Section>
  );
}
