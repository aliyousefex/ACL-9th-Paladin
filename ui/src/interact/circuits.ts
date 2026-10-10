/** Original schematic centerlines. These are not surveyed maps. */

export const CIRCUIT_PATHS: Record<string, string> = {
  "Suzuka Circuit":
    "M230 110C230 42 348 42 348 110C348 178 230 178 230 110C230 42 72 42 72 110C72 178 230 178 230 110",
  "Yas Marina Circuit":
    "M64 86C72 46 150 30 248 34C330 38 364 62 360 98C356 138 292 164 198 168C112 172 48 146 46 112C44 96 52 108 64 86",
  "Circuit de Monaco":
    "M96 146C74 140 58 104 74 66C92 28 168 24 228 40C286 56 332 36 346 74C360 114 324 150 258 162C198 174 128 168 96 146",
  "Circuit de Barcelona-Catalunya":
    "M72 128C58 82 96 40 168 32C256 22 338 46 358 92C374 130 328 164 236 170C148 176 88 158 72 128",
  "Circuit de Spa-Francorchamps":
    "M58 138C46 92 78 42 156 30C246 16 340 32 362 74C378 106 346 132 270 126C196 120 142 158 88 160C66 162 58 154 58 138",
  "Circuit de Nevers Magny-Cours":
    "M84 118C74 72 136 38 208 42C286 46 338 82 326 124C314 168 228 184 158 164C100 148 90 146 84 118",
  "Istanbul Park":
    "M96 148C54 118 64 58 132 36C204 12 312 28 348 74C376 110 338 158 246 170C156 182 118 166 96 148",
  "Sepang International Circuit":
    "M86 72C128 34 228 26 304 48C362 66 374 114 336 148C294 184 176 186 112 154C56 126 48 102 86 72",
};

export const CIRCUIT_SHORT: Record<string, string> = {
  "Circuit de Nevers Magny-Cours": "Magny-Cours",
  "Istanbul Park": "Istanbul",
  "Dijon-Prenois": "Dijon",
  "Circuit Bremgarten": "Bremgarten",
  "Sepang International Circuit": "Sepang",
  "Suzuka Circuit": "Suzuka",
  "Yas Marina Circuit": "Yas Marina",
  "Circuit de Monaco": "Monaco",
  "Circuit de Barcelona-Catalunya": "Barcelona",
  "Circuit de Spa-Francorchamps": "Spa",
};
