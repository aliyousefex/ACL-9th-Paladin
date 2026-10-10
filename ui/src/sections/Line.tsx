import { WeekendScrubber } from "../interact/WeekendScrubber";
import { Section } from "../components/Section";

export function Line() {
  return (
    <Section id="line" title="Move the weekend up to the lights">
      <WeekendScrubber />
    </Section>
  );
}
