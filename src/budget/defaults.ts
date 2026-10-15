import type { BudgetCategory, BudgetSettings, CategoryKind } from './types';

const cat = (id: string, name: string, kind: CategoryKind, monthly = 0): BudgetCategory => ({ id, name, kind, monthly });

/** Placeholder monthly budgets — edit on Budget › Setup. */
export function defaultBudgetSettings(): BudgetSettings {
  return {
    version: 1,
    aiEnabled: true,
    accounts: [],
    rules: [],
    categories: [
      cat('groceries', 'Groceries', 'expense', 1250),
      cat('dining', 'Dining & takeaway', 'expense', 500),
      cat('coffee', 'Coffee', 'expense', 120),
      cat('alcohol', 'Alcohol', 'expense', 150),
      cat('transport', 'Transport & fuel', 'expense', 250),
      cat('car', 'Car (rego, service)', 'expense', 100),
      cat('utilities', 'Utilities', 'expense', 300),
      cat('phone', 'Phone & internet', 'expense', 150),
      cat('insurance', 'Insurance', 'expense', 450),
      cat('health', 'Health & medical', 'expense', 250),
      cat('fitness', 'Fitness', 'expense', 200),
      cat('entertainment', 'Entertainment & gigs', 'expense', 250),
      cat('subscriptions', 'Subscriptions', 'expense', 80),
      cat('shopping', 'Shopping', 'expense', 300),
      cat('home', 'Home & garden', 'expense', 250),
      cat('travel', 'Travel', 'expense', 650),
      cat('personal', 'Personal care', 'expense', 100),
      cat('gifts', 'Gifts & donations', 'expense', 150),
      cat('education', 'Education', 'expense', 0),
      cat('fees', 'Fees & interest', 'expense', 0),
      cat('mortgage', 'Mortgage', 'expense', 0),
      cat('other', 'Other spending', 'expense', 200),
      cat('salary', 'Salary', 'income', 0),
      cat('other-income', 'Other income (bonus, side work)', 'income', 0),
      cat('transfers', 'Transfers between accounts', 'transfer'),
      cat('reimbursement', 'Paid back by others', 'transfer'),
      cat('money-in', 'Other money in (refunds, interest)', 'transfer'),
      cat('card-repayment', 'Credit card repayment', 'transfer'),
      cat('investing', 'Savings & investing', 'transfer'),
    ],
  };
}

/**
 * Built-in keyword rules for common Australian merchants. Matched against the cleaned,
 * upper-case description; first match wins. `dir` limits a rule to money in or out.
 * They map to default category ids and are skipped if that category was deleted.
 */
export const KEYWORD_RULES: { re: RegExp; cat: string; dir?: 'in' | 'out' }[] = [
  { re: /\b(SALARY|PAYROLL|WAGES|PAY ?RUN)\b/, cat: 'salary', dir: 'in' },
  { re: /\b(CREDIT INTEREST|INTEREST (PAID|CREDIT|EARNED)|BONUS INTEREST|DIVIDEND|DISTRIBUTION|ATO|TAX REFUND|CASHBACK|REFUND|REVERSAL)\b/, cat: 'money-in', dir: 'in' },
  { re: /\b(TRANSFER (TO|FROM)|INTERNAL TRANSFER|TFR (TO|FROM)|FUNDS TRANSFER|INTERNET TRANSFER|MOVED (TO|FROM))\b/, cat: 'transfers' },
  { re: /\b(CREDIT CARD|CC PAYMENT|CARD PAYMENT|PAYMENT (RECEIVED|THANK ?YOU)|THANK YOU PAYMENT|AMEX|AMERICAN EXPRESS)\b/, cat: 'card-repayment' },
  { re: /\b(VANGUARD|PEARLER|STAKE|SELFWEALTH|COMMSEC|SHARESIES|SPACESHIP|RAIZ|BETASHARES|SUPERHERO|CMC MARKETS|NABTRADE|INTERACTIVE BROKERS|MOOMOO)\b/, cat: 'investing' },
  { re: /\b(HOME LOAN|LOAN REPAYMENT|MORTGAGE|LN REPAY|LOAN PAYMENT)\b/, cat: 'mortgage', dir: 'out' },
  { re: /\b(WOOLWORTHS|WOOLIES|COLES|ALDI|IGA|HARRIS FARM|FOODWORKS|COSTCO|ABOUT LIFE|THOMAS DUX|FRUITO|SUPERMARKET|GROCER|BUTCHER|BAKERY|FLEMINGTON)\b/, cat: 'groceries', dir: 'out' },
  { re: /\b(UBER ?EATS|DOORDASH|MENULOG|DELIVEROO|MCDONALD|MCDONALDS|KFC|HUNGRY JACK|GUZMAN|DOMINO|NANDO|SUBWAY|OPORTO|GRILLD|BETTER BURGER|SUSHI|PIZZA|PIZZERIA|THAI|RESTAURANT|BISTRO|DUMPLING|RAMEN|BURGER|KEBAB|NOODLE|TAQUERIA|EATERY|KITCHEN|DINER)\b/, cat: 'dining', dir: 'out' },
  { re: /\b(CAFE|COFFEE|ESPRESSO|ROASTERS|STARBUCKS|GLORIA JEAN|PATISSERIE)\b/, cat: 'coffee', dir: 'out' },
  { re: /\b(DAN MURPHY|DAN MURPHYS|BWS|LIQUORLAND|FIRST CHOICE|VINTAGE CELLARS|BOTTLE ?SHOP|BOTTLE-?O|LIQUOR|BREWERY|BREWING|WINERY|CELLARS)\b/, cat: 'alcohol', dir: 'out' },
  { re: /\b(UBER (TRIP|BV)|UBER$|DIDI|OLA|13CABS|TAXI|TRANSPORTFORNSW|TRANSPORT FOR NSW|OPAL|LINKT|ETOLL|E ?TAG|WILSON PARKING|SECURE PARKING|PARKING|AMPOL|CALTEX|BP|SHELL|7 ?ELEVEN|SEVEN ELEVEN|UNITED PETROL|METRO PETROLEUM|EG FUEL|FUEL|LIME|BEAM|NEURON|GOGET|CAR NEXT DOOR)\b/, cat: 'transport', dir: 'out' },
  { re: /\b(SERVICE NSW|RMS|REGO|ULTRA TUNE|MIDAS|REPCO|SUPERCHEAP AUTO|BRIDGESTONE|BEAUREPAIRES|MECHANIC|SMASH REPAIR|CAR WASH)\b/, cat: 'car', dir: 'out' },
  { re: /\b(ORIGIN|AGL|ENERGYAUSTRALIA|ENERGY AUSTRALIA|RED ENERGY|ALINTA|SYDNEY WATER|JEMENA|POWERSHOP|AMBER ELECTRIC|ELECTRICITY|ENOVA|GLOBIRD|MOMENTUM ENERGY|COUNCIL|STRATA)\b/, cat: 'utilities', dir: 'out' },
  { re: /\b(TELSTRA|OPTUS|VODAFONE|TPG|AUSSIE BROADBAND|AUSSIE BB|IINET|BELONG|AMAYSIM|BOOST MOBILE|SUPERLOOP|LEAPTEL|FELIX MOBILE|CIRCLES LIFE|SPINTEL|TANGERINE|DODO)\b/, cat: 'phone', dir: 'out' },
  { re: /\b(NRMA|AAMI|ALLIANZ|BUDGET DIRECT|YOUI|SUNCORP|QBE|GIO|MEDIBANK|BUPA|HCF|NIB|AHM|TAL|INSURANCE|INSURE)\b/, cat: 'insurance', dir: 'out' },
  { re: /\b(CHEMIST|PHARMACY|PRICELINE|MEDICAL|DENTAL|DENTIST|PHYSIO|PATHOLOGY|OPTOMETR\w*|SPECSAVERS|DOCTOR|CLINIC|HOSPITAL|RADIOLOGY|PSYCH\w*|HEALTH)\b/, cat: 'health', dir: 'out' },
  { re: /\b(GYM|FITNESS|ANYTIME FITNESS|F45|YOGA|PILATES|CLIMBING|BOULDER\w*|SWIM\w*|AQUATIC|LEISURE CENTRE|CROSSFIT|CLASSPASS|STRAVA)\b/, cat: 'fitness', dir: 'out' },
  { re: /\b(NETFLIX|SPOTIFY|STAN|DISNEY|BINGE|KAYO|FOXTEL|YOUTUBE|APPLE COM|APPLE\.COM|ITUNES|GOOGLE STORAGE|GOOGLE ONE|AMAZON PRIME|PRIME VIDEO|AUDIBLE|PATREON|ADOBE|MICROSOFT|DROPBOX|OPENAI|CHATGPT|ANTHROPIC|CLAUDE\.AI|PARAMOUNT|SUBSTACK|ICLOUD)\b/, cat: 'subscriptions', dir: 'out' },
  { re: /\b(TICKETEK|TICKETMASTER|MOSHTIX|OZTIX|EVENTBRITE|HUMANITIX|DICE|CINEMA|CINEMAS|HOYTS|PALACE|DENDY|STEAM|PLAYSTATION|NINTENDO|XBOX|BOWLING|THEATRE|ENMORE THEATRE|OXFORD ART FACTORY|MANNING BAR|LANSDOWNE HOTEL)\b/, cat: 'entertainment', dir: 'out' },
  { re: /\b(BUNNINGS|IKEA|MITRE 10|TOTAL TOOLS|NURSERY|GARDEN\w*|HARDWARE|BEACON LIGHTING|ADAIRS|BED BATH|FREEDOM|PLANT\w*|HOMEWARES)\b/, cat: 'home', dir: 'out' },
  { re: /\b(KMART|TARGET|BIG W|MYER|DAVID JONES|UNIQLO|AMAZON|AMZN|EBAY|JB HI|JB HIFI|HARVEY NORMAN|OFFICEWORKS|REBEL|THE ICONIC|COTTON ON|DECATHLON|KATHMANDU|BOOKTOPIA|DYMOCKS|BOOKS|TEMU|SHEIN)\b/, cat: 'shopping', dir: 'out' },
  { re: /\b(QANTAS|VIRGIN AUSTRALIA|VIRGIN AUST|JETSTAR|REX AIRLINES|AIRBNB|BOOKING COM|BOOKING\.COM|EXPEDIA|HOTELS COM|AGODA|AIRASIA|WEBJET|HOTEL|MOTEL|HOSTEL|RESORT|AIRPORT)\b/, cat: 'travel', dir: 'out' },
  { re: /\b(HAIR|BARBER|BEAUTY|NAILS?|MECCA|SEPHORA|SALON|MASSAGE|SPA)\b/, cat: 'personal', dir: 'out' },
  { re: /\b(DONATION|CHARITY|RED CROSS|GOFUNDME|UNICEF|OXFAM|SALVATION ARMY|WWF)\b/, cat: 'gifts', dir: 'out' },
  { re: /\b(UNIVERSITY|TAFE|UDEMY|COURSERA|MASTERCLASS|SKILLSHARE)\b/, cat: 'education', dir: 'out' },
  { re: /\b(FEE|FEES|INTEREST CHARGED?|INT CHARGED|ATM|OVERDRAWN|LATE PAYMENT|INTL TRANSACTION)\b/, cat: 'fees', dir: 'out' },
];
