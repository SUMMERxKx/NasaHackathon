# Sources

Every external source EMBER uses, with its address and licence. This file feeds the References field of the project submission.

## NASA data

The NASA Physical Sciences Informatics (PSI) repository, psi.nasa.gov. Snapshot taken on 2026-11-14. No key and no login.

| Endpoint | Used for |
|---|---|
| `https://psi.nasa.gov/geode-py/ws/repo/search?source=psi&type=investigation&from=0&size=300` | The list of investigations |
| `https://psi.nasa.gov/geode-py/ws/repo/investigations/{ACCESSION}` | One investigation record |
| `https://psi.nasa.gov/geode-py/ws/studies/{ACCESSION}/download?source=datamanager&file={FILE}` | One experimental table, as CSV |

Every fetched file is listed in `data/raw/manifest.json` with its address, size and hash.

### The 24 combustion investigations

| Accession | Name in EMBER | Title | DOI | Licence |
|---|---|---|---|---|
| PSI-10 | ACME Flame Design | Advanced Combustion via Microgravity Experiments / Flame Design | `10.60555/w4zy-bt45` | not listed |
| PSI-20 | ACME BRE | Advanced Combustion via Microgravity Experiments - Burning Rate Emulator | `10.60555/vb93-3y72` | CC0-1.0 |
| PSI-21 | ACME CLD Flame | Advanced Combustion via Microgravity Experiments / Coflow Laminar Diffusion Flame | `10.60555/23e1-9950` | CC0-1.0 |
| PSI-22 | ACME E-FIELD Flames | Advanced Combustion via Microgravity Experiments Electric-Field Effects on Laminar Diffusion Flames | `10.60555/se5a-8c73` | CC0-1.0 |
| PSI-23 | ACME s-Flame | Advanced Combustion via Microgravity Experiments-Structure and Response of Spherical Diffusion Flames | `10.60555/k57n-p030` | CC0-1.0 |
| PSI-25 | BASS-II | Burning and Suppression of Solids - II | `10.60555/4qc4-de67` | CC0-1.0 |
| PSI-26 | BASS | Burning and Suppression of Solids | `10.60555/58h4-dy80` | CC0-1.0 |
| PSI-39 | CFI | Cool Flames Investigation | `10.60555/m6pj-a914` | CC0-1.0 |
| PSI-47 | DAFT and DAFT-2 | Dust and Aerosol Measurement Feasibility Test / Dust and Aerosol Measurement Feasibility Test-2 | `10.60555/ztgj-d202` | CC0-1.0 |
| PSI-60 | SPICE data analysis | Computational and Experimental Analysis of SPICE Data Sets | `10.60555/mzjm-yv57` | CC0-1.0 |
| PSI-62 | BASS flame spread modelling | Concurrent Flame Spread Modeling using Flamelet Generated Manifolds in Microgravity with Comparison to BASS Experiments using Two-Color Tomography | `10.60555/e9xp-ex83` | CC0-1.0 |
| PSI-68 | FLEX-2 | Flame Extinguishment Experiment - 2 | `10.60555/byp8-h018` | CC0-1.0 |
| PSI-69 | FLEX | Flame Extinguishment Experiment | `10.60555/mbq8-0451` | CC0-1.0 |
| PSI-98 | Saffire-I | Spacecraft Fire Safety Experiment-I | `10.60555/0t15-1z43` | CC0-1.0 |
| PSI-99 | Saffire-II | Spacecraft Fire Experiment-II | `10.60555/2chp-m469` | CC0-1.0 |
| PSI-100 | Saffire-III | Spacecraft Fire Experiment-III | `10.60555/040q-4h36` | CC0-1.0 |
| PSI-101 | SAME-R | Smoke Aerosol Measurement Experiment-Reflight | `10.60555/2np7-jv14` | CC0-1.0 |
| PSI-102 | SAME | Smoke and Aerosol Measurement Experiment | `10.60555/gd4k-8h62` | CC0-1.0 |
| PSI-106 | SLICE | Structure and Liftoff In Combustion Experiment | `10.60555/pm12-rg61` | CC0-1.0 |
| PSI-107 | SPICE | Smoke Point In Co-flow Experiment | `10.60555/9kbh-e962` | CC0-1.0 |
| PSI-115 | SAME smoke simulation | Utilization of the Smoke Aerosol Measurement Experiment Data for Advanced Modeling and Simulation of Smoke Generation in Micro-Gravity | `10.60555/q0v5-1v28` | CC0-1.0 |
| PSI-117 | Cool flame CFD analysis | Effect of External Thermo-Convective Perturbation on Cool Flame Dynamics: A Multidimensional Multi-Physics CFD Analysis | `10.60555/gz0q-b577` | CC0-1.0 |
| PSI-142 | Cool flame counterflow study | Quantitative Studies of Cool Flame Transitions at Radiation / Stretch Extinction Using Counterflow Flames | `10.60555/80qf-vj95` | CC0-1.0 |
| PSI-159 | ACME CFI-G | Advanced Combustion via Microgravity Experiments / Cool Flames Investigation with Gases | `10.60555/cyt1-kh64` | CC0-1.0 |

No image from a PSI record is shown in EMBER. The image endpoint of PSI returned the same NASA program badge for every record, which is NASA branding, so EMBER draws its own neutral tile for each investigation.

## The ten challenge resources

From the Resources tab of the challenge page, read on 14 November 2026.

- [PSI Data Repository: Combustion Science](https://psi.nasa.gov/physci/repo/search?q=combustion). The data source. Every number in EMBER comes from it.
- [NASA Combustion Science](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/). A More from NASA link on every investigation page and a second source for the plain summaries.
- [NASA ScienceCasts: The Power of Studying Combustion on the ISS (video, 2018)](https://www.youtube.com/watch?v=W1oXykoz9zg). The Watch first link on the Brief. Linked, never copied.
- [A Researcher's Guide to International Space Station Combustion Science (2015)](https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/). The glossary, the science explainers and the two ends of the fireball's temperature scale.
- [Apollo 1](https://sma.nasa.gov/sma-disciplines/accllp/apollo-1). An incident card on the Brief, written with respect.
- [Apollo 13](https://sma.nasa.gov/sma-disciplines/accllp/apollo-13). An incident card on the Brief.
- [25 Years Ago: Fire Aboard Space Station Mir](https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/). An incident card on the Brief.
- [Fireman's Air Tanks (1970s spinoff)](https://spinoff.nasa.gov/node/9582). A spinoff card on the Earth screen.
- [Fire Detector (1970s spinoff)](https://spinoff.nasa.gov/node/9407). A spinoff card on the Earth screen, linked to the SAME and DAFT investigations.
- [New Technology for the Fire Attire (1980s spinoff)](https://spinoff.nasa.gov/node/9918). A spinoff card on the Earth screen.

The Researcher's Guide is also a PDF: https://www.nasa.gov/wp-content/uploads/2016/05/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf . Page 8 gives the two ends of the fireball's temperature scale: "Typical flame temperatures are on the order of 2,300 degrees Kelvin, whereas ambient temperatures are approximately 300 degrees Kelvin."

## Other NASA and event pages

- The challenge statement: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall
- The Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- NASA, Studying Combustion and Fire Safety: https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/
- NASA Technical Reports Server 20130013505, Effects of the 8 psia / 32% O2 Atmosphere on the Human in the Spaceflight Environment, 2013: https://ntrs.nasa.gov/citations/20130013505
- NASA Technical Reports Server 20150021491, Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere, 2015: https://ntrs.nasa.gov/citations/20150021491

Only the abstracts of the two reports were read. The science lead settles the wording of the Exploration atmosphere preset.

## Papers

Each is listed in a PSI record. EMBER takes the wording of findings from the PSI record text and the tables, not from the papers.

- Dietrich and co-authors, Droplet Combustion Experiments Aboard the International Space Station, Microgravity Science and Technology, 2014. doi 10.1007/s12217-014-9372-2
- Nayagam and co-authors, Can cool flames support quasi-steady alkane droplet burning?, Combustion and Flame, 2012. doi 10.1016/j.combustflame.2012.07.012
- Olson and Ferkul, Microgravity flammability boundary for PMMA rods in axial stagnation flow, Combustion and Flame, 2017. doi 10.1016/j.combustflame.2017.03.001
- Urban and co-authors, Flame spread: Effects of microgravity and scale, Combustion and Flame, 2019. doi 10.1016/j.combustflame.2018.10.012
- Meyer and co-authors, Smoke Characterization and Feasibility of the Moment Method for Spacecraft Fire Detection, Aerosol Science and Technology, 2015. doi 10.1080/02786826.2015.1025124

## The live language models

| Role | Model | Reached through | Listing |
|---|---|---|---|
| First choice | Claude Haiku 5.5, `anthropic/claude-haiku-5.5` | OpenRouter, from a Vercel Function | https://openrouter.ai/anthropic/claude-haiku-5.5 |
| Backup | GPT-6 Luna, `openai/gpt-6-luna` | OpenRouter, from a Vercel Function | https://openrouter.ai/openai/gpt-6-luna |

## The search model

| Piece | Source | Licence |
|---|---|---|
| `Xenova/all-MiniLM-L6-v2`, the 8-bit file `onnx/model_quantized.onnx` and its tokenizer files | https://huggingface.co/Xenova/all-MiniLM-L6-v2 | Apache 2.0 |
| The ONNX runtime for the browser, two builds copied from the `onnxruntime-web` package at build time | https://www.npmjs.com/package/onnxruntime-web | MIT |

The model files are committed under `public/models/embed` and served by the site itself. No search model file is fetched from another host at run time.

## Libraries

Installed versions, from `package-lock.json`.

| Package | Version | Licence |
|---|---|---|
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 |
| `@fontsource-variable/jetbrains-mono` | 5.3.0 | OFL-1.1 |
| `@fontsource-variable/space-grotesk` | 5.3.0 | OFL-1.1 |
| `@huggingface/transformers` | 4.3.2 | Apache-2.0 |
| `d3-array` | 3.2.5 | ISC |
| `d3-dsv` | 3.0.2 | ISC |
| `d3-interpolate` | 3.0.2 | ISC |
| `d3-scale` | 4.0.3 | ISC |
| `d3-shape` | 3.2.1 | ISC |
| `lucide-react` | 1.73.0 | ISC |
| `minisearch` | 7.2.0 | MIT |
| `motion` | 14.14.0 | MIT |
| `react` | 19.3.1 | MIT |
| `react-dom` | 19.3.1 | MIT |
| `react-router-dom` | 7.18.5 | MIT |
| `three` | 0.187.0 | MIT |
| `@tailwindcss/vite` | 4.3.5 | MIT |
| `@types/d3-array` | 3.2.2 | MIT |
| `@types/d3-dsv` | 3.0.7 | MIT |
| `@types/d3-interpolate` | 3.0.4 | MIT |
| `@types/d3-scale` | 4.0.9 | MIT |
| `@types/d3-shape` | 3.2.0 | MIT |
| `@types/node` | 24.19.2 | MIT |
| `@types/react` | 19.3.0 | MIT |
| `@types/react-dom` | 19.3.0 | MIT |
| `@types/three` | 0.187.0 | MIT |
| `@vitejs/plugin-react` | 6.3.0 | MIT |
| `tailwindcss` | 4.3.5 | MIT |
| `typescript` | 7.0.2 | Apache-2.0 |
| `vite` | 8.3.8 | MIT |
| `vitest` | 5.1.0 | MIT |

The three typefaces are Inter, Space Grotesk and JetBrains Mono, bundled from the Fontsource packages under the SIL Open Font Licence 1.1.

## Hosting

Vercel, free Hobby plan. No database.

## Images

No image or video was made with an SI image generator. The fireball is drawn by shader code in the browser and carries the label "SI-generated illustration". No NASA logo, insignia or mission patch is used.
