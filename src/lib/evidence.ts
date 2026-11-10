/** Sources the post-run analysis cites. Every finding that rests on outside knowledge links to one of these. */
export const EVIDENCE = {
  intensity: {
    title: "Stöggl & Sperlich 2015 - Training intensity distribution (Frontiers in Physiology)",
    url: "https://www.frontiersin.org/articles/10.3389/fphys.2015.00295/full",
  },
  polarizedMeta: {
    title: "Oliveira et al. 2024 - Polarized training meta-analysis (Sports Medicine)",
    url: "https://link.springer.com/content/pdf/10.1007/s40279-024-02034-z.pdf",
  },
  srpe: {
    title: "Haddad et al. 2017 - Session-RPE method: validity and reliability (review)",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5673663/",
  },
  wristHr: {
    title: "Gillinov et al. 2017 (ACC) - Wrist-worn HR monitors less accurate than a chest strap",
    url: "https://www.acc.org/About-ACC/Press-Releases/2017/03/08/14/02/Wrist-worn-Heart-Rate-Monitors-Less-Accurate-Than-Standard-Chest-Strap",
  },
  taper: {
    title: "Bosquet et al. 2007 - Effects of tapering on performance: a meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/17762369/",
  },
} as const;
export type EvidenceKey = keyof typeof EVIDENCE;
