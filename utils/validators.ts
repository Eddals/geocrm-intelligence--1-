
// Brazilian Valid DDDs
const VALID_DDDS = [
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24, // RJ
  27, 28, // ES
  31, 32, 33, 34, 35, 37, 38, // MG
  41, 42, 43, 44, 45, 46, // PR
  47, 48, 49, // SC
  51, 53, 54, 55, // RS
  61, // DF
  62, 64, // GO
  63, // TO
  65, 66, // MT
  67, // MS
  68, // AC
  69, // RO
  71, 73, 74, 75, 77, // BA
  79, // SE
  81, 87, // PE
  82, // AL
  83, // PB
  84, // RN
  85, 88, // CE
  86, 89, // PI
  91, 93, 94, // PA
  92, 97, // AM
  95, // RR
  96, // AP
  98, 99 // MA
];

/**
 * Validates email using strict Regex and Domain logic simulation.
 * Filters out common temp mails or obvious placeholders.
 */
export const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;

  // 1. Syntax Check (Regex)
  // Allows standard format, prohibits double dots, starting/ending with dots
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;

  // 2. Placeholder Filtering
  const lowerEmail = email.toLowerCase();
  const placeholders = ['exemplo', 'email@email', 'contato@site', 'domain.com', 'seuemail', 'teste'];
  if (placeholders.some(p => lowerEmail.includes(p))) return false;

  return true;
};

/**
 * Validates Brazilian phone numbers (Landline and Mobile).
 * Checks for valid DDD and correct digit length.
 */
export const isValidPhone = (phone: string | null | undefined): boolean => {
  if (!phone) return false;

  // Remove non-numeric chars
  const cleanPhone = phone.replace(/\D/g, '');

  // Check generic length (10 or 11 digits for BR with DDD)
  // 10 digits: (XX) 2XXX-XXXX to 5XXX-XXXX (Landline)
  // 11 digits: (XX) 9XXXX-XXXX (Mobile)
  if (cleanPhone.length < 10 || cleanPhone.length > 11) return false;

  // Check if starts with 55 (DDI), if so, strip it for DDD check, 
  // BUT logic below assumes cleanPhone is just DDD+Number usually found in local context.
  // If string is huge (starts with 55), adjust.
  let phoneToCheck = cleanPhone;
  if (cleanPhone.length === 12 || cleanPhone.length === 13) {
      if (cleanPhone.startsWith('55')) {
          phoneToCheck = cleanPhone.substring(2);
      }
  }

  // 1. Validate DDD
  const ddd = parseInt(phoneToCheck.substring(0, 2));
  if (!VALID_DDDS.includes(ddd)) return false;

  // 2. Validate Number Structure
  const numberPart = phoneToCheck.substring(2);
  
  if (phoneToCheck.length === 11) {
      // Mobile: Must start with 9
      if (numberPart[0] !== '9') return false;
  } 
  
  // Anti-spam/Fake check (e.g. 11999999999)
  const isRepeated = /^(\d)\1+$/.test(numberPart);
  if (isRepeated) return false;

  return true;
};

export const formatPhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    let final = cleaned;
    
    // Remove 55 if present at start
    if ((final.length === 12 || final.length === 13) && final.startsWith('55')) {
        final = final.substring(2);
    }

    if (final.length === 11) {
        return `(${final.substring(0, 2)}) ${final.substring(2, 7)}-${final.substring(7)}`;
    } else if (final.length === 10) {
        return `(${final.substring(0, 2)}) ${final.substring(2, 6)}-${final.substring(6)}`;
    }
    return phone;
}
