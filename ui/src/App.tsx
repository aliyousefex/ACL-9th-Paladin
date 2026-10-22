import { lazy, Suspense, useEffect } from "react";
import { LightsLoader } from "./components/Bits";
import { Shell } from "./components/Shell";
import { RACES, raceHref } from "./lib/data";
import { navigate, useLocation, useScrollOnNavigate } from "./lib/router";

const Home = lazy(() => import("./features/home/Home").then((m) => ({ default: m.Home })));
const RacePage = lazy(() => import("./features/race/RacePage").then((m) => ({ default: m.RacePage })));
const DriversPage = lazy(() => import("./features/drivers/DriversPage").then((m) => ({ default: m.DriversPage })));
const CircuitsPage = lazy(() => import("./features/circuits/CircuitsPage").then((m) => ({ default: m.CircuitsPage })));
const ModelPage = lazy(() => import("./features/model/ModelPage").then((m) => ({ default: m.ModelPage })));
const MethodPage = lazy(() => import("./features/method/MethodPage").then((m) => ({ default: m.MethodPage })));

export default function App() {
  const location = useLocation();
  useScrollOnNavigate(location);

  // Old walkthrough links such as #book keep working and are rewritten to their canonical address.
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (id && !id.startsWith("/") && location.path[0] === "method") window.history.replaceState(null, "", `#/method/${id}`);
  }, [location.key, location.path]);
  const [first, second, third] = location.path;
  const section = first ?? "";

  let page;
  switch (section) {
    case "race":
      page = second && third ? <RacePage year={Number(second)} slug={third} /> : <GoLatest />;
      break;
    case "drivers":
      page = <DriversPage reference={second} query={location.query} />;
      break;
    case "circuits":
      page = <CircuitsPage reference={second} query={location.query} />;
      break;
    case "model":
      page = <ModelPage />;
      break;
    case "method":
      page = <MethodPage section={second} />;
      break;
    default:
      page = <Home query={location.query} />;
  }

  // The method page is one long document: moving between its sections must not remount it.
  const key = section === "method" ? "method" : location.path.join("/");

  return (
    <Shell section={["race", "drivers", "circuits", "model", "method"].includes(section) ? section : ""}>
      <Suspense fallback={<div className="pt-32"><LightsLoader label="Loading" /></div>}>
        <div key={key}>{page}</div>
      </Suspense>
    </Shell>
  );
}

function GoLatest() {
  useEffect(() => {
    navigate(raceHref(RACES[RACES.length - 1]));
  }, []);
  return null;
}
