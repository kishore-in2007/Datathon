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
  return { seeded: count < rows.length, cases: rows.length };
}
