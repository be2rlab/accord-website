# The project page

A static page: `index.html`, `style.css`, `js/` and the media in `assets/`, which `scripts/build_site.py` makes from the
runs that [sources.json](sources.json) names and from the paper in `paper/`. It needs no build step and no server code;
any static host serves it.

```bash
python3 scripts/build_site.py --source SOURCE    # all of it (SOURCE: the tree that holds the runs; paths in sources.json are under it)
python3 scripts/build_site.py --source ... --only maps --dataset ori
python3 scripts/build_site.py --source ... --only videos --reencode
python3 scripts/build_site.py --source ... --only results --only facts      # after the paper's tables changed
python3 -m http.server -d website 8000                           # then http://localhost:8000
```

The host needs numpy, scipy, ffmpeg and pdftoppm. The page loads three.js from jsDelivr and, for a replay, Rerun's web
viewer from unpkg. A path in `sources.json` that starts with `repo:` is in this repository (the paper's own tables and
figures); every other one is under `--source`.

## What it shows

- **The film.** The opening video (`film` in `sources.json`), encoded with its sound at 1280 px, with a poster and a
  chapter per scene, read from the film's own record. It plays muted when the page opens; "Play with sound" starts it
  over with its music.
- **Facts.** The four numbers under the film (`facts`): each `{name}` is the paper's macro of that name
  (`paper/tables/gen*macros.tex`), so they change with the paper.
- **Abstract.** The paper's, read from `paper/sec/0_abstract.tex`.
- **Results at a glance.** One panel per test set (`scoreboard`), one bar per dense pipeline: the mean map score the
  paper's tables typeset. Each panel has its own scale; a pipeline whose every sequence failed is listed as failed, one
  that was not run is left out. The page computes nothing but the bars' lengths and who is first.
- **Results in full.** The paper's Tab. 2 and Tab. 3 as typeset, read from the rows the paper inputs
  (`repo:paper/tables/gen5_overview_rows.tex`, `gen7_phones_rows.tex`); the build stops on a cell it cannot show.
- **Maps.** For each sequence, our map and the other pipelines' maps.
  - **Placement.** Every map is placed in the laser scan's frame by its score report's `map_to_reference`: the rigid fit
    of that pipeline's trajectory to the reference, nothing fitted to the scan. The build checks the map's SHA-256
    against the report and the scan's against the report's `reference_sha256`. A scan whose local copy differs is looked
    for under `scan_mirrors`.
  - **Our run.** Of a sequence's runs of record, the one of the median map score (the paper's figures make the same
    choice), with DA3-Giant.
  - **Other pipelines.** The scored points of the paper's figures for MASt3R-Fusion, VGGT-SLAM and ScaRF on EuRoC and ORI.
    Elsewhere, their own runs with their reports. DAVIO as released (the base system) on EuRoC and ORI: of its
    three runs, the one of the median map score. A pipeline that failed or made no map is listed with why
    (`missing` in `sources.json`; failed: a trajectory more than 10 m off, the paper's rule).
  - **Thinning.** Each cloud is thinned to one point per `voxel_m`, at most 500,000 points for every pipeline alike.
  - **Colouring.** Each point's distance to the scan colours it for display only.
  - **Scores.** The numbers in the table are the reports' own; the page computes none.
- **Videos.** The renders named in `sources.json`, encoded to at most 1280 px wide, aiming at 8 MB each (14 MB for the
  featured one), with a poster frame. The fly-throughs do not fit 8 MB even at the lowest quality tried, and come out
  at 13 to 16 MB.
- **Replays.** Rerun recordings, opened in Rerun's web viewer on click.
- **Method and figures.** The paper's figures that `sources.json` names (`figures`, each with a caption and the section
  it goes in): the architecture, and under the results the per-sequence spectrum and the Oxford Spires comparison,
  rendered from their PDFs.
- **Posters.** A still per dataset for its card where its videos have none (`posters`), scaled to 720 px.
- **Dataset.** The phone rig's walks, from the release's `sequences.csv`.
- **Code and citation.** The commands of the repository's README; the BibTeX entry is written from `identity`.

## Design

The film's look: deep navy, one warm accent (Accord's orange), white type. The opening, the bar on top, the code
blocks and the footer are navy in both themes; between them the page is light by default and dark on request (the
toggle, the system's setting, or `?theme=dark` in the address). Type: Inter Tight for headings and numbers, Inter for
text, JetBrains Mono for labels, from Google Fonts. The pipelines' colours are the paper's; `palette_note` in
`sources.json` says how they were checked.

## Changing it

- **Content.** Add a sequence, a pipeline, a video or a replay in `sources.json`, then build that part again.
- **First shot.** The opening view of each dataset (`LOOK`) is set in `js/app.js`.
- **Authors and links.** `identity` in `sources.json`: `authors`, `affiliation`, `title`, `year`, `code`. The paper's
  button opens `arxiv` when it is set, else the PDF named by `paper_pdf`, which the build copies to `assets/accord.pdf`.
  Any build writes them to `catalog.json`.

`assets/` holds about 585 MB: videos 255 (the film 41), maps 225, recordings 85, the paper 15. On GitHub Pages, keep
each file under 100 MB; the build reports a video it could not fit.
