// The company behind Ribriz Travel. One place for legal and contact details,
// used by the footer, emails, structured data and Riya.

export const COMPANY = {
  brand: "Ribriz Travel",
  legalName: "Ribriz Overseas Ventures Private Limited",
  cin: "U85499KA2024PTC187740",
  email: "hello@ribriztravel.com",
  website: "https://www.ribriztravel.com",
  address: {
    lines: ["Unit 101, Oxford Towers", "139, HAL Old Airport Rd, Kodihalli", "Bengaluru, Karnataka 560008", "India"],
    street: "Unit 101, Oxford Towers, 139, HAL Old Airport Rd, Kodihalli",
    city: "Bengaluru", region: "Karnataka", postalCode: "560008", country: "IN",
  },
  /** GST registration (Karnataka). Tax invoices are issued under this number. */
  gstin: "29AANCR5772Q1Z6",
  gstState: "29",
  /** We don't take phone calls: support is by email and through Riya, 24×7. */
  phone: null,
} as const;

/**
 * What we can actually offer today. Switch a flag on only when it's real
 * (e.g. EMI once a payment partner offers it), and the site shows it again.
 */
export const OFFERS = {
  /** 0% EMI needs a payment partner (e.g. Razorpay) with EMI enabled */
  emi: false,
} as const;

export const ADDRESS_ONE_LINE = COMPANY.address.lines.join(", ");
