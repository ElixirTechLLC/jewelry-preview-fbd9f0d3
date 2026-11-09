/* ------------------------------------------------------------------
   SITE CONFIG — everything you will want to change before go-live
   lives in this one file: brand name, contact details, financing.
------------------------------------------------------------------- */
window.SITE = {
  // PLACEHOLDER brand — change these two lines to rename the whole site.
  brand: "Aurum & Onyx",
  tagline: "Fine Jewelry · Designed & Made In-House",

  // PLACEHOLDER contact details — replace with the real shop details.
  contact: {
    phone: "(000) 000-0000",
    email: "hello@example.com",
    addressLine1: "[Street address]",
    addressLine2: "[City, State ZIP]",
    hours: [
      ["Monday – Friday", "[10:00 am – 6:00 pm]"],
      ["Saturday", "[10:00 am – 5:00 pm]"],
      ["Sunday", "[By appointment]"],
    ],
    instagram: "#",
    facebook: "#",
    tiktok: "#",
  },

  /* ----------------------------------------------------------------
     FINANCING — PLACEHOLDER.
     Every financing message on the site is generated from this block.
     At go-live: fill in the real provider and terms, then set
     isPlaceholder to false to remove the "placeholder" notices.
  ----------------------------------------------------------------- */
  financing: {
    isPlaceholder: true,
    provider: "[Financing Partner]",
    applyUrl: "#", // link to the provider's application
    exampleTermMonths: 36, // used for the "from $X/mo" estimates
    exampleApr: 0, // % APR used for estimates (0 = simple division)
    minPurchase: 0,
    plans: [
      { months: 6, label: "6 months", note: "[Terms TBD]" },
      { months: 12, label: "12 months", note: "[Terms TBD]" },
      { months: 24, label: "24 months", note: "[Terms TBD]" },
      { months: 36, label: "36 months", note: "[Terms TBD]" },
    ],
    disclosure:
      "Placeholder example only — not an offer of credit. Final provider, rates, terms and eligibility will be published here at launch.",
  },

  // Default diamond quality line shown when a piece does not override it.
  diamondDefaults: { color: "G–H", clarity: "VS1–VS2", origin: "Natural" },

  imageNote:
    "Images are digital renderings. Each piece is made to order in our shop; gold and diamond weights are approximate and vary slightly with size.",
};
