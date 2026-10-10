export type CarPhoto = {
  src: string;
  alt: string;
  team: string;
  detail: string;
  credit: string;
  creditHref: string;
  license: string;
  licenseHref: string;
  crop?: string;
};

export const CARS = {
  mercedes: {
    src: "/cars/mercedes-w13.jpg",
    alt: "Lewis Hamilton driving the silver and teal Mercedes-AMG F1 W13 at the 2022 Emilia Romagna Grand Prix",
    team: "Mercedes",
    detail: "Lewis Hamilton, W13, Imola 2022. The Jeddah case is the same driver and season, a different race.",
    credit: "Roberto Monti",
    creditHref: "https://commons.wikimedia.org/wiki/File:2022_Emilia_Romagna_GP_-_Mercedes-AMG_F1_W13_E_Performance_of_Lewis_Hamilton.jpg",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  williams: {
    src: "/cars/williams-fw43.jpg",
    alt: "George Russell in the Williams FW43 during 2020 Formula 1 testing at Barcelona, with measuring rakes fitted",
    team: "Williams",
    detail: "George Russell, FW43, Barcelona test 2020. The explanation below is Zandvoort 2021.",
    credit: "Artes Max",
    creditHref: "https://commons.wikimedia.org/wiki/File:2020_Formula_One_tests_Barcelona,_Williams_FW43,_Russell.jpg",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0/",
  },
  aston: {
    src: "/cars/aston-amr23.jpg",
    alt: "Aston Martin AMR23 Formula 1 car on display, teal bodywork and a dark front wing",
    team: "Aston Martin",
    detail: "AMR23, a 2023 display car. It is not one of the starts in the retirement table.",
    credit: "Calreyn88",
    creditHref: "https://commons.wikimedia.org/wiki/File:2023_Aston_Martin_AMR23.jpg",
    license: "CC0",
    licenseHref: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  redbull: {
    src: "/cars/redbull-rb18.jpg",
    alt: "Red Bull RB18 Formula 1 show car, number 1, dark body with a yellow nose, indoors against a blue wall",
    team: "Red Bull",
    detail: "RB18, number 1, an indoor show car. It is not a start in the table. Red Bull's 2022-2024 row counts every start in that era.",
    credit: "Calreyn88",
    creditHref: "https://commons.wikimedia.org/wiki/File:2022_Red_Bull_RB18.jpg",
    license: "CC0",
    licenseHref: "https://creativecommons.org/publicdomain/zero/1.0/",
    crop: "object-[center_46%]",
  },
  mclaren: {
    src: "/cars/mclaren-mcl60.jpg",
    alt: "McLaren MCL60 Formula 1 show car, number 4, papaya and black, on an outdoor display stand",
    team: "McLaren",
    detail: "MCL60, number 4, on display in 2023. A show car, not one of the starts behind McLaren's row.",
    credit: "Calreyn88",
    creditHref: "https://commons.wikimedia.org/wiki/File:2023_McLaren_MCL60.jpg",
    license: "CC0",
    licenseHref: "https://creativecommons.org/publicdomain/zero/1.0/",
    crop: "object-center",
  },
  alpine: {
    src: "/cars/alpine-a522.jpg",
    alt: "Esteban Ocon driving the blue and pink Alpine A522 at the 2022 British Grand Prix",
    team: "Alpine",
    detail: "Esteban Ocon, A522, 2022 British Grand Prix. One car on one weekend. Alpine's row is the whole 2022-2024 era.",
    credit: "Chris Game",
    creditHref: "https://commons.wikimedia.org/wiki/File:2022_British_GP_-_Alpine_A522_of_Esteban_Ocon_(2).jpg",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0/",
    crop: "object-[center_62%]",
  },
} as const satisfies Record<string, CarPhoto>;

export function CarFrame({
  photo,
  eager = false,
}: {
  photo: CarPhoto;
  eager?: boolean;
}) {
  return (
    <figure>
      <img
        src={photo.src}
        alt={photo.alt}
        width={1600}
        height={1000}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        decoding="async"
        className={`aspect-[16/10] w-full object-cover ${photo.crop ?? "object-center"}`}
      />
      <figcaption className="mt-2 text-[0.92rem] leading-snug text-steel">
        <span className="text-ink">{photo.team}. </span>
        {photo.detail}{" "}
        <a
          href={photo.creditHref}
          className="underline decoration-line underline-offset-[3px] hover:text-ink"
        >
          {photo.credit}
        </a>
        {", "}
        <a
          href={photo.licenseHref}
          className="underline decoration-line underline-offset-[3px] hover:text-ink"
        >
          {photo.license}
        </a>
        .
      </figcaption>
    </figure>
  );
}
