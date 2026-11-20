/**
 * Content for the public front page. Edit here — no other code changes needed.
 * Anything left blank is simply not shown.
 */
export const SITE = {
  location: {
    name: "The Back Nine Golf — North Arlington",
    address: "",        // e.g. "1234 Example Rd, Suite 100, Arlington, TX 76006"
    hours: "",          // e.g. "Lessons by appointment · Members 24/7"
    // What Google Maps searches for (map + Get directions). Once the address is filled in, it's used instead.
    mapQuery: "The Back Nine Golf Arlington TX North",
  },
};

/**
 * Student results for the front page. Only add real students, with their permission.
 * The section stays hidden until at least one result is here.
 */
export type StudentResult = {
  name: string;         // first name + last initial, e.g. "Mike R."
  stat: string;         // the headline change, e.g. "+18 yds"
  label: string;        // what it measures, e.g. "7-iron carry"
  before?: string;      // e.g. "142 yds"
  after?: string;       // e.g. "160 yds"
  weeks?: number;       // over how long
  quote?: string;       // a sentence in their words
};

export const STUDENT_RESULTS: StudentResult[] = [];
