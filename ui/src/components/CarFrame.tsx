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
    detail: "Lewis Hamilton, W13, Imola 2022.",
    credit: "Roberto Monti",
    creditHref: "https://commons.wikimedia.org/wiki/File:2022_Emilia_Romagna_GP_-_Mercedes-AMG_F1_W13_E_Performance_of_Lewis_Hamilton.jpg",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  williams: {
    src: "/cars/williams-fw43.jpg",
    alt: "George Russell in the Williams FW43 during 2020 Formula 1 testing at Barcelona, with measuring rakes fitted",
    team: "Williams",
    detail: "George Russell, FW43, Barcelona 2020.",
    credit: "Artes Max",
    creditHref: "https://commons.wikimedia.org/wiki/File:2020_Formula_One_tests_Barcelona,_Williams_FW43,_Russell.jpg",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0/",
  },
  aston: {
    src: "/cars/aston-amr23.jpg",
    alt: "Aston Martin AMR23 Formula 1 car on display, teal bodywork and a dark front wing",
    team: "Aston Martin",
    detail: "AMR23, 2023.",
    credit: "Calreyn88",
    creditHref: "https://commons.wikimedia.org/wiki/File:2023_Aston_Martin_AMR23.jpg",
    license: "CC0",
    licenseHref: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  redbull: {
    src: "/cars/redbull-rb18.jpg",
    alt: "Red Bull RB18 Formula 1 show car, number 1, dark body with a yellow nose, indoors against a blue wall",
    team: "Red Bull",
    detail: "RB18.",
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
    detail: "MCL60, 2023.",
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
    detail: "Esteban Ocon, A522, British Grand Prix 2022.",
    credit: "Chris Game",
    creditHref: "https://commons.wikimedia.org/wiki/File:2022_British_GP_-_Alpine_A522_of_Esteban_Ocon_(2).jpg",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0/",
    crop: "object-[center_62%]",
  },
  ferrari: {
    src: "/cars/ferrari-sf23.jpg",
    alt: "Carlos Sainz driving the red Ferrari at the 2023 Italian Grand Prix",
    team: "Ferrari",
    detail: "Carlos Sainz, Monza 2023.",
    credit: "Eustace Bagge",
    creditHref: "https://commons.wikimedia.org/wiki/File:Carlos_Sainz_-_2023_Italian_Grand_Prix.jpg",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0/",
    crop: "object-[center_70%]",
  },
  alfa: {
    src: "/cars/alfa-romeo-c43.jpg",
    alt: "Valtteri Bottas driving the Alfa Romeo at the 2023 Italian Grand Prix",
    team: "Alfa Romeo",
    detail: "Valtteri Bottas, Monza 2023.",
    credit: "Eustace Bagge",
    creditHref: "https://commons.wikimedia.org/wiki/File:Valtteri_Bottas_-_2023_Monza_Grand_Prix_-_F1.jpg",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0/",
    crop: "object-[center_68%]",
  },
  haas: {
    src: "/cars/haas-vf22.jpg",
    alt: "Kevin Magnussen driving the white and red Haas VF-22 at the 2022 British Grand Prix",
    team: "Haas",
    detail: "Kevin Magnussen, VF-22, British Grand Prix 2022.",
    credit: "Chris Game",
    creditHref: "https://commons.wikimedia.org/wiki/File:2022_British_GP_-_Haas_VF-22_of_Kevin_Magnussen_(1).jpg",
    license: "CC BY-SA 2.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/2.0/",
    crop: "object-[center_64%]",
  },
  alphatauri: {
    src: "/cars/alphatauri-at03.jpg",
    alt: "Yuki Tsunoda driving the white and navy AlphaTauri in qualifying at the 2022 British Grand Prix",
    team: "AlphaTauri",
    detail: "Yuki Tsunoda, British Grand Prix 2022.",
    credit: "Timfilbert",
    creditHref: "https://commons.wikimedia.org/wiki/File:Yuki_Tsunoda_in_qualifying_for_the_2022_British_Grand_Prix.jpg",
    license: "CC BY-SA 4.0",
    licenseHref: "https://creativecommons.org/licenses/by-sa/4.0/",
    crop: "object-[center_72%]",
  },
} as const satisfies Record<string, CarPhoto>;

export function CarFrame({
  photo,
  eager = false,
}: {
  photo: CarPhoto;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure>
      {failed ? (
        <div className="grid aspect-[16/10] w-full place-items-center border border-line bg-tower p-6 text-center">
          <p>
            <span className="font-display text-[1.5rem] text-ink">{photo.team}</span>
            <span className="mt-2 block text-steel">Image unavailable. {photo.detail}</span>
          </p>
        </div>
      ) : (
        <img
          src={photo.src}
          alt={photo.alt}
          width={1600}
          height={1000}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "low"}
          decoding="async"
          onError={() => setFailed(true)}
          className={`aspect-[16/10] w-full object-cover ${photo.crop ?? "object-center"}`}
        />
      )}
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
import { useState } from "react";
