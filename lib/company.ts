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
  /** We don't take phone calls: support is by email and through Riya, 24×7. */
  phone: null,
} as const;

export const ADDRESS_ONE_LINE = COMPANY.address.lines.join(", ");
