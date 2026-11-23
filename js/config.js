/* ------------------------------------------------------------------
   SITE CONFIG — everything you will want to change before go-live
   lives in this one file: brand name, contact details, financing.
------------------------------------------------------------------- */
window.SITE = {
  // Brand. "logoName" is the large word in the logo; "logoSub" the small line under it.
  brand: "Wolf’s Fine Jewelry",
  logoName: "Wolf’s",
  logoSub: "Fine Jewelry",
  tagline: "Tappan, New York",

  // PLACEHOLDER contact details — replace with the real shop details.
  contact: {
    phone: "(000) 000-0000",
    email: "hello@example.com",
    addressLine1: "111 NY-303",
    addressLine2: "Tappan, NY 10983",
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
      "Example only, not an offer of credit. The provider, rates, terms and eligibility will be published here at launch.",
  },

  /* DESIGN STUDIO — the address of the design API once it is deployed on Vercel,
     e.g. "https://jewelry-design-api.vercel.app". Empty = the studio shows a "coming soon" note. */
  designApi: "",
  // Full-size product photos. Before launch they live on the Vercel Blob store and only the 800px web copies
  // (assets/products-sm) are in this repo; the product page builds originals' URLs from this base + "products/<id>/<file>".
  // Empty = load originals from assets/products locally. Change at go-live when the photos move to their final host.
  imageBase: "https://di5t1gkk0gbtq3uh.public.blob.vercel-storage.com/",

  imageNote:
    "Each piece is made to order in our workshop. Prices follow the day's gold price and are confirmed, with the final gold and diamond weights, before we begin.",
};
