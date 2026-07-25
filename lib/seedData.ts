import { initDb } from "./db";

const districts = ["Bengaluru North", "Bengaluru South", "Mysuru", "Mangaluru", "Hubballi"];
const crimes = ["chain-snatching", "cyber fraud", "theft", "narcotics", "assault", "vehicle theft"];
const names = ["Aarav Bhat", "Asha Gowda", "Deepak Hegde", "Divya Iyer", "Farhan Khan", "Geetha Kulkarni", "Harish Naik", "Ishaan Patil", "Kavya Rao", "Manoj Reddy", "Meera Shetty", "Naveen Bhat", "Priya Gowda", "Rahul Hegde", "Sanjay Khan", "Shilpa Rao", "Vikram Naik", "Zoya Shetty"];
const places: Record<string, { areas: string[]; lat: number; lon: number }> = {
  "Bengaluru North": { areas: ["Yelahanka", "Hebbal", "Peenya", "Jalahalli"], lat: 13.08, lon: 77.57 },
  "Bengaluru South": { areas: ["Jayanagar", "BTM Layout", "Banashankari", "JP Nagar"], lat: 12.91, lon: 77.59 },
  Mysuru: { areas: ["Vijayanagar", "Nazarbad", "Kuvempunagar", "Lashkar"], lat: 12.3, lon: 76.65 },
  Mangaluru: { areas: ["Kadri", "Hampankatta", "Kankanady", "Surathkal"], lat: 12.91, lon: 74.86 },
  Hubballi: { areas: ["Vidya Nagar", "Gokul Road", "Keshwapur", "Old Hubballi"], lat: 15.36, lon: 75.12 },
};
let state = 72451;
const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

type Person = { name: string; age: number; gender: string; area: string; role: string };
type CaseRow = {
  fir: string; district: string; station: string; date: string; crime: string; status: string;
  narrative: string; lat: number; lon: number; area: string; people: Person[];
};

const manualPeople = [
  { name: "Arjun Dev", age: 34, gender: "Male", area: "Hebbal" },
  { name: "Nandini Rao", age: 29, gender: "Female", area: "Yelahanka" },
  { name: "Faisal Ahmed", age: 38, gender: "Male", area: "Peenya" },
  { name: "Lakshmi Prasad", age: 42, gender: "Female", area: "Jalahalli" },
  { name: "Rohan Das", age: 31, gender: "Male", area: "Hebbal" },
  { name: "Meghana Joshi", age: 27, gender: "Female", area: "Yelahanka" },
];

const manualCases = [
  ["MAN/2026/001", "2026-06-03", "vehicle theft", "Hebbal", "A white utility vehicle was stolen from a secured apartment parking area at 02:15. CCTV showed Arjun Dev coordinating with Faisal Ahmed while Rohan Das drove a second vehicle.", [["Arjun Dev","accused"],["Faisal Ahmed","accused"],["Rohan Das","accused"],["Lakshmi Prasad","witness"]]],
  ["MAN/2026/002", "2026-06-07", "vehicle theft", "Yelahanka", "A motorcycle was removed outside Yelahanka New Town market. Nandini Rao identified Arjun Dev and Rohan Das from station photographs after observing them near the ignition lock.", [["Arjun Dev","accused"],["Rohan Das","accused"],["Nandini Rao","witness"]]],
  ["MAN/2026/003", "2026-06-11", "theft", "Peenya", "Copper cable bundles were taken from an industrial storage yard. Entry records and camera footage placed Faisal Ahmed and Arjun Dev at the service gate shortly before the loss.", [["Faisal Ahmed","accused"],["Arjun Dev","accused"],["Lakshmi Prasad","witness"]]],
  ["MAN/2026/004", "2026-06-15", "vehicle theft", "Jalahalli", "A delivery van disappeared during a driver changeover. Meghana Joshi reported seeing Rohan Das transfer the vehicle keys to Arjun Dev near the loading bay.", [["Rohan Das","accused"],["Arjun Dev","accused"],["Meghana Joshi","witness"]]],
  ["MAN/2026/005", "2026-06-19", "cyber fraud", "Hebbal", "A fraudulent vehicle-sale listing collected advance payments from three complainants. The payment account was operated by Nandini Rao and login records were linked to Faisal Ahmed.", [["Nandini Rao","accused"],["Faisal Ahmed","accused"],["Lakshmi Prasad","victim"]]],
  ["MAN/2026/006", "2026-06-23", "vehicle theft", "Peenya", "Two commercial motorcycles were removed from a warehouse compound. Toll-camera records connected Arjun Dev, Faisal Ahmed and Rohan Das to the transport vehicle.", [["Arjun Dev","accused"],["Faisal Ahmed","accused"],["Rohan Das","accused"]]],
  ["MAN/2026/007", "2026-06-27", "theft", "Yelahanka", "Electronic diagnostic equipment was stolen from a repair workshop after closing. Meghana Joshi provided footage showing Nandini Rao meeting Arjun Dev outside the premises.", [["Nandini Rao","accused"],["Arjun Dev","accused"],["Meghana Joshi","witness"]]],
  ["MAN/2026/008", "2026-07-01", "vehicle theft", "Hebbal", "A sedan was stolen using a cloned key near Hebbal flyover. Traffic video showed Arjun Dev driving with Faisal Ahmed following on a motorcycle.", [["Arjun Dev","accused"],["Faisal Ahmed","accused"],["Lakshmi Prasad","victim"]]],
  ["MAN/2026/009", "2026-07-04", "chain-snatching", "Jalahalli", "A gold chain was taken from a pedestrian near the metro entrance. Nandini Rao witnessed Rohan Das riding the motorcycle and identified Arjun Dev as the pillion rider.", [["Rohan Das","accused"],["Arjun Dev","accused"],["Nandini Rao","witness"]]],
  ["MAN/2026/010", "2026-07-07", "vehicle theft", "Yelahanka", "A rental vehicle was obtained with forged identification and not returned. Documents used Faisal Ahmed's photograph, while location records showed meetings with Arjun Dev.", [["Faisal Ahmed","accused"],["Arjun Dev","accused"],["Meghana Joshi","witness"]]],
  ["MAN/2026/011", "2026-07-10", "narcotics", "Peenya", "A vehicle intercepted near the industrial ring road contained packaged narcotics. Arjun Dev was driving and Rohan Das occupied the passenger seat; Faisal Ahmed was linked through call records.", [["Arjun Dev","accused"],["Rohan Das","accused"],["Faisal Ahmed","accused"]]],
  ["MAN/2026/012", "2026-07-12", "theft", "Hebbal", "Number plates and vehicle control modules were recovered from a rented garage. The lease named Nandini Rao and fingerprints matched Arjun Dev and Faisal Ahmed.", [["Nandini Rao","accused"],["Arjun Dev","accused"],["Faisal Ahmed","accused"]]],
  ["MAN/2026/013", "2026-07-14", "vehicle theft", "Jalahalli", "A hatchback stolen from a hospital parking area was recovered with altered plates. Rohan Das was detained nearby and messages connected him to Arjun Dev.", [["Rohan Das","accused"],["Arjun Dev","accused"],["Lakshmi Prasad","victim"]]],
  ["MAN/2026/014", "2026-07-16", "cyber fraud", "Yelahanka", "Online advertisements offered stolen vehicle components. The seller account belonged to Nandini Rao and delivery records identified Faisal Ahmed as the dispatcher.", [["Nandini Rao","accused"],["Faisal Ahmed","accused"],["Meghana Joshi","witness"]]],
  ["MAN/2026/015", "2026-07-18", "vehicle theft", "Peenya", "A truck tractor was taken during an overnight halt. CCTV placed Arjun Dev, Faisal Ahmed and Rohan Das around the cab before departure.", [["Arjun Dev","accused"],["Faisal Ahmed","accused"],["Rohan Das","accused"]]],
  ["MAN/2026/016", "2026-07-20", "assault", "Hebbal", "A workshop owner was assaulted after confronting persons handling suspected stolen parts. The complainant named Arjun Dev and Rohan Das; Nandini Rao witnessed the dispute.", [["Arjun Dev","accused"],["Rohan Das","accused"],["Nandini Rao","witness"],["Lakshmi Prasad","victim"]]],
  ["MAN/2026/017", "2026-07-22", "vehicle theft", "Yelahanka", "Police recovered two stolen motorcycles during a warehouse search. Arjun Dev held the keys, Faisal Ahmed maintained the inventory, and Meghana Joshi documented prior vehicle movements.", [["Arjun Dev","accused"],["Faisal Ahmed","accused"],["Meghana Joshi","witness"]]],
  ["MAN/2026/018", "2026-07-24", "theft", "Jalahalli", "A coordinated search recovered cloned keys, number plates and ownership documents. Evidence connected Arjun Dev, Faisal Ahmed, Rohan Das and Nandini Rao across the earlier FIRs.", [["Arjun Dev","accused"],["Faisal Ahmed","accused"],["Rohan Das","accused"],["Nandini Rao","accused"]]],
] as const;

async function ensureManualCases() {
  const db = await initDb();
  const manualFirs = manualCases.map(([fir]) => fir);
  const existing = await db.execute({
    sql: `SELECT COUNT(*) AS count FROM cases WHERE fir_no IN (${manualFirs.map(() => "?").join(",")})`,
    args: manualFirs,
  });
  if (Number(existing.rows[0]?.count || 0) >= manualCases.length) return false;
  const personStatements = manualPeople.map((person) => ({
    sql: `INSERT INTO persons (name,age,gender,address_area)
      SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM persons WHERE name=?)`,
    args: [person.name, person.age, person.gender, person.area, person.name],
  }));
  await db.batch(personStatements, "write");
  for (const [fir, date, crime, area, narrative, people] of manualCases) {
    const already = await db.execute({ sql: "SELECT 1 FROM cases WHERE fir_no=? LIMIT 1", args: [fir] });
    if (already.rows.length) continue;
    const place = places["Bengaluru North"];
    await db.batch([
      { sql: "INSERT INTO cases (fir_no,district,station,date_reported,crime_type,status,narrative) VALUES (?,'Bengaluru North',?,?,?,?,?)",
        args: [fir, `${area} Police Station`, date, crime, "under_investigation", narrative] },
      { sql: "INSERT INTO locations (case_id,lat,lon,area_name) VALUES ((SELECT case_id FROM cases WHERE fir_no=?),?,?,?)",
        args: [fir, place.lat, place.lon, area] },
      ...people.map(([name, role]) => ({
        sql: "INSERT INTO case_persons (case_id,person_id,role) SELECT c.case_id,p.person_id,? FROM cases c,persons p WHERE c.fir_no=? AND p.name=? ORDER BY p.person_id LIMIT 1",
        args: [role, fir, name],
      })),
    ], "write");
  }
  return true;
}

export async function seedDatabase() {
  const db = await initDb();
  const existing = await db.execute("SELECT COUNT(*) AS count FROM cases");
  const count = Number(existing.rows[0]?.count || 0);
  state = 72451;
  const rows: CaseRow[] = [];
  const trendWeeks = [3, 6, 9, 12, 15, 18, 21, 24];
  let trendIndex = 0;

  for (let index = 0; index < 950; index++) {
    let district = pick(districts);
    let crime = pick(crimes);
    let ageDays = Math.floor(random() * 365);
    if (trendIndex < trendWeeks.reduce((a, b) => a + b, 0)) {
      district = "Bengaluru North";
      crime = "chain-snatching";
      let bucket = 7;
      let cursor = trendIndex++;
      while (cursor >= trendWeeks[bucket]) cursor -= trendWeeks[bucket--];
      ageDays = bucket * 7 + Math.floor(random() * 7);
    }
    const place = places[district];
    let area = pick(place.areas);
    let lat = place.lat + (random() - 0.5) * 0.07;
    let lon = place.lon + (random() - 0.5) * 0.07;
    if (index < 40) {
      district = "Mysuru"; crime = "vehicle theft"; area = "Vijayanagar";
      lat = 12.327 + (random() - 0.5) * 0.008; lon = 76.613 + (random() - 0.5) * 0.008;
      ageDays = Math.floor(random() * 21);
    }
    const people = Array.from({ length: 1 + Math.floor(random() * 3) }, () => ({
      name: pick(names), age: 18 + Math.floor(random() * 52), gender: pick(["Male", "Female"]),
      area, role: pick(["accused", "victim", "witness"]),
    }));
    rows.push({
      fir: `${district.slice(0, 3).toUpperCase()}/${new Date().getUTCFullYear()}/${String(index + 1).padStart(4, "0")}`,
      district, station: `${area} Police Station`, date: daysAgo(ageDays), crime,
      status: pick(["open", "under_investigation", "closed"]),
      narrative: `A ${crime} complaint was reported near ${area}. Officers documented witness accounts, secured available evidence, and initiated coordinated follow-up enquiries.`,
      lat, lon, area, people,
    });
  }
  const networkNames = ["Ravi Naik", "Imran Khan", "Kiran Gowda", "Sunil Patil", "Manju Shetty", "Ajay Rao", "Prakash Reddy", "Salman Bhat", "Tejas Hegde"];
  for (let index = 0; index < 5; index++) {
    rows.push({
      fir: `BNN/${new Date().getUTCFullYear()}/NET${index + 1}`, district: "Bengaluru North",
      station: "Hebbal Police Station", date: daysAgo(4 + index * 5), crime: "vehicle theft",
      status: "under_investigation", area: "Hebbal", lat: 13.04 + index * 0.001, lon: 77.59,
      narrative: "A coordinated vehicle theft case was linked through shared persons and repeated movement patterns.",
      people: networkNames.filter((_, personIndex) => personIndex === 0 || (personIndex + index) % 3 !== 0)
        .map((name, personIndex) => ({ name, age: 24 + personIndex, gender: "Male", area: "Hebbal", role: "accused" })),
    });
  }

  // Turso batch limits favor small transactional chunks.
  for (let offset = Math.min(count, rows.length); offset < rows.length; offset += 25) {
    const statements = rows.slice(offset, offset + 25).flatMap((row) => [
      { sql: "INSERT INTO cases (fir_no,district,station,date_reported,crime_type,status,narrative) VALUES (?,?,?,?,?,?,?)",
        args: [row.fir, row.district, row.station, row.date, row.crime, row.status, row.narrative] },
      { sql: "INSERT INTO locations (case_id,lat,lon,area_name) VALUES (last_insert_rowid(),?,?,?)",
        args: [row.lat, row.lon, row.area] },
      ...row.people.flatMap((person) => [
        { sql: "INSERT INTO persons (name,age,gender,address_area) VALUES (?,?,?,?)",
          args: [person.name, person.age, person.gender, person.area] },
        { sql: "INSERT INTO case_persons (case_id,person_id,role) VALUES ((SELECT case_id FROM cases WHERE fir_no=?),last_insert_rowid(),?)",
          args: [row.fir, person.role] },
      ]),
    ]);
    await db.batch(statements, "write");
  }
  const manualSeeded = await ensureManualCases();
  await db.batch([
    "DELETE FROM network_edges",
    `UPDATE case_persons SET person_id = (
      SELECT MIN(p2.person_id) FROM persons p2
      WHERE p2.name = (SELECT p1.name FROM persons p1 WHERE p1.person_id = case_persons.person_id)
    )`,
    `DELETE FROM persons WHERE person_id NOT IN (SELECT DISTINCT person_id FROM case_persons)`,
    `INSERT INTO network_edges (person_a, person_b, shared_case_id, weight)
    SELECT a.person_id, b.person_id, MIN(a.case_id), COUNT(DISTINCT a.case_id)
    FROM case_persons a JOIN case_persons b ON a.case_id=b.case_id AND a.person_id<b.person_id
    GROUP BY a.person_id,b.person_id`,
  ], "write");
  const finalCount = await db.execute("SELECT COUNT(*) AS count FROM cases");
  return { seeded: count < rows.length || manualSeeded, cases: Number(finalCount.rows[0]?.count || 0), manualCases: manualCases.length };
}
