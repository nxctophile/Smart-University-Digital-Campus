// Deterministic PRNG so repeated seed runs produce stable demo data.
export function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function pickWeighted<T>(rand: () => number, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

export function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

export const FIRST_NAMES_M = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Krishna", "Ishaan",
  "Rohan", "Kabir", "Aryan", "Dhruv", "Samarth", "Rudra", "Yash", "Shaurya",
  "Om", "Atharv", "Karan", "Devansh", "Nikhil", "Ansh", "Parth", "Ayaan",
  "Harsh", "Kunal", "Raghav", "Siddharth", "Tanish", "Vedant", "Lakshya", "Manav",
];
export const FIRST_NAMES_F = [
  "Ananya", "Diya", "Ishita", "Saanvi", "Aadhya", "Myra", "Anika", "Kavya",
  "Navya", "Riya", "Sara", "Aditi", "Avni", "Prisha", "Trisha", "Pihu",
  "Kiara", "Mahika", "Nitya", "Vanya", "Aarohi", "Bhavya", "Charvi", "Disha",
  "Gauri", "Ira", "Jiya", "Khushi", "Lavanya", "Mira", "Palak", "Rhea",
];
export const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Mehta", "Patel", "Reddy", "Nair", "Iyer",
  "Rao", "Joshi", "Kulkarni", "Deshmukh", "Chauhan", "Singh", "Yadav", "Malhotra",
  "Kapoor", "Bhatt", "Trivedi", "Pandey", "Mishra", "Tiwari", "Agarwal", "Bansal",
  "Chatterjee", "Banerjee", "Das", "Ghosh", "Menon", "Pillai", "Shetty", "Rathore",
];

export function fullName(rand: () => number): { first: string; last: string; gender: "male" | "female" } {
  const gender = rand() > 0.48 ? "male" : "female";
  const first = gender === "male" ? pick(rand, FIRST_NAMES_M) : pick(rand, FIRST_NAMES_F);
  const last = pick(rand, LAST_NAMES);
  return { first, last, gender };
}

export const AVATAR_COLORS = ["#1B2B4B", "#0E7490", "#7C3AED", "#B45309", "#0F766E", "#BE123C"];
