import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ─── Demo User ───────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { id: "demo-user" },
    update: { name: "Spencer" },
    create: { id: "demo-user", name: "Spencer", email: "spencer@waterwatcher.dev" },
  });
  console.log(`  ✓ User: ${user.name} (${user.id})`);

  // ─── Rivers ──────────────────────────────────────────────
  const colorado = await prisma.river.upsert({
    where: { awId: "383" },
    update: {},
    create: {
      name: "Colorado River — Gore Canyon",
      state: "CO",
      region: "Rocky Mountains",
      latitude: 39.805,
      longitude: -106.525,
      difficulty: "Class III-IV",
      description:
        "Gore Canyon is one of Colorado's most challenging commercially rafted stretches. Continuous Class III-IV whitewater through a dramatic 2,000-foot deep canyon.",
      awId: "383",
      usgsGaugeId: "09058000",
      imageUrl: "https://images.unsplash.com/photo-1504276048855-f3d1e4c69687?w=800",
    },
  });

  const salmon = await prisma.river.upsert({
    where: { awId: "3948" },
    update: {},
    create: {
      name: "Salmon River — Main Salmon",
      state: "ID",
      region: "Pacific Northwest",
      latitude: 45.178,
      longitude: -114.048,
      difficulty: "Class III-IV",
      description:
        "The Main Salmon, known as the 'River of No Return,' offers 79 miles of wilderness rafting through the largest wilderness area in the lower 48 states.",
      awId: "3948",
      imageUrl: "https://images.unsplash.com/photo-1474524955719-b9f87c50ce47?w=800",
    },
  });

  const arkansas = await prisma.river.upsert({
    where: { awId: "380" },
    update: {},
    create: {
      name: "Arkansas River — Browns Canyon",
      state: "CO",
      region: "Rocky Mountains",
      latitude: 38.747,
      longitude: -106.119,
      difficulty: "Class III",
      description:
        "Browns Canyon National Monument features 8 miles of exciting Class III rapids set in a beautiful granite canyon. Colorado's most popular rafting run.",
      awId: "380",
      usgsGaugeId: "07091200",
      imageUrl: "https://images.unsplash.com/photo-1530569673472-307dc017a82d?w=800",
    },
  });

  console.log(`  ✓ Rivers: ${colorado.name}, ${salmon.name}, ${arkansas.name}`);

  // ─── Track rivers for demo user ─────────────────────────
  for (const river of [colorado, salmon, arkansas]) {
    await prisma.userRiver.upsert({
      where: { userId_riverId: { userId: user.id, riverId: river.id } },
      update: {},
      create: { userId: user.id, riverId: river.id, notify: true },
    });
  }
  console.log("  ✓ Demo user tracking all 3 rivers");

  // ─── River Conditions ────────────────────────────────────
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const conditionsData = [
    {
      riverId: colorado.id,
      flowRate: 1250,
      gaugeHeight: 3.8,
      waterTemp: 52,
      quality: "good",
      runnability: "optimal",
      source: "usgs",
      scrapedAt: now,
    },
    {
      riverId: colorado.id,
      flowRate: 1180,
      gaugeHeight: 3.6,
      waterTemp: 51,
      quality: "good",
      runnability: "optimal",
      source: "usgs",
      scrapedAt: fourHoursAgo,
    },
    {
      riverId: salmon.id,
      flowRate: 8500,
      gaugeHeight: 5.2,
      waterTemp: 48,
      quality: "excellent",
      runnability: "optimal",
      source: "aw",
      scrapedAt: now,
    },
    {
      riverId: salmon.id,
      flowRate: 9200,
      gaugeHeight: 5.5,
      waterTemp: 47,
      quality: "excellent",
      runnability: "optimal",
      source: "aw",
      scrapedAt: twoHoursAgo,
    },
    {
      riverId: arkansas.id,
      flowRate: 680,
      gaugeHeight: 2.9,
      waterTemp: 55,
      quality: "fair",
      runnability: "runnable",
      source: "usgs",
      scrapedAt: now,
    },
    {
      riverId: arkansas.id,
      flowRate: 720,
      gaugeHeight: 3.0,
      waterTemp: 54,
      quality: "good",
      runnability: "runnable",
      source: "usgs",
      scrapedAt: fourHoursAgo,
    },
  ];

  for (const cond of conditionsData) {
    await prisma.riverCondition.create({ data: cond });
  }
  console.log(`  ✓ Conditions: ${conditionsData.length} records`);

  // ─── Hazards ─────────────────────────────────────────────
  const hazardsData = [
    {
      riverId: colorado.id,
      type: "strainer",
      severity: "warning",
      title: "Downed tree at mile 3.2",
      description: "Large cottonwood partially blocking river right channel. Portage left.",
      source: "aw",
      reportedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      riverId: colorado.id,
      type: "permit_required",
      severity: "info",
      title: "Commercial permit required",
      description: "Gore Canyon requires a commercial outfitter. Private boaters must register with BLM.",
      source: "blm",
      reportedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      riverId: salmon.id,
      type: "rapid_change",
      severity: "warning",
      title: "High water advisory",
      description: "Flows above 8,000 CFS increase difficulty by one class. Scout all major rapids.",
      source: "aw",
      reportedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      riverId: salmon.id,
      type: "permit_required",
      severity: "info",
      title: "Lottery permit required June-September",
      description: "Main Salmon requires a permit from the USFS during peak season. Apply via recreation.gov.",
      source: "usfs",
      reportedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      riverId: arkansas.id,
      type: "logjam",
      severity: "warning",
      title: "Log accumulation below Zoom Flume",
      description: "Debris pile building on river left below Zoom Flume rapid. Stay center/right.",
      source: "aw",
      reportedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      riverId: arkansas.id,
      type: "closure",
      severity: "danger",
      title: "Railroad Bridge construction",
      description: "Temporary portage required at mile 5.1 due to bridge work. Expected through March 2026.",
      source: "blm",
      reportedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  ];

  // Use createMany to avoid duplicate issues on re-runs — delete existing first, then insert
  await prisma.hazard.deleteMany({
    where: { riverId: { in: [colorado.id, salmon.id, arkansas.id] } },
  });
  await prisma.hazard.createMany({ data: hazardsData });
  console.log(`  ✓ Hazards: ${hazardsData.length} records`);

  // ─── Campsites ───────────────────────────────────────────
  const campsitesData = [
    {
      riverId: colorado.id,
      name: "Gore Canyon Trailhead Camp",
      latitude: 39.812,
      longitude: -106.531,
      type: "blm",
      amenities: ["fire_ring", "toilet"],
      permitReq: false,
      description: "Basic camping near the put-in with parking for about 15 vehicles.",
      source: "blm",
    },
    {
      riverId: salmon.id,
      name: "Corn Creek Launch Site",
      latitude: 45.179,
      longitude: -114.049,
      type: "usfs",
      amenities: ["fire_ring", "toilet", "water", "boat_ramp"],
      permitReq: true,
      description: "Main launch site for Main Salmon trips. Pit toilets and potable water available.",
      source: "usfs",
    },
    {
      riverId: arkansas.id,
      name: "Hecla Junction Campground",
      latitude: 38.739,
      longitude: -106.109,
      type: "blm",
      amenities: ["fire_ring", "toilet", "boat_ramp"],
      permitReq: false,
      description: "Popular put-in campground with 22 sites along the river. First-come, first-served.",
      source: "blm",
    },
  ];

  await prisma.campsite.deleteMany({
    where: { riverId: { in: [colorado.id, salmon.id, arkansas.id] } },
  });
  await prisma.campsite.createMany({ data: campsitesData });
  console.log(`  ✓ Campsites: ${campsitesData.length} records`);

  // ─── Rapids ──────────────────────────────────────────────
  const rapidsData = [
    {
      riverId: colorado.id,
      name: "Appaloosa",
      difficulty: "Class IV",
      mile: 1.5,
      description: "Technical entry move followed by a big hole on the left.",
      runGuide: "Enter center-right, then move left above the hole. Boof or skirt the hole on the right.",
      source: "aw",
    },
    {
      riverId: colorado.id,
      name: "Gore Rapid",
      difficulty: "Class IV",
      mile: 2.8,
      description: "The signature rapid. A long, powerful Class IV with multiple channels.",
      runGuide: "Scout from river left. Main line is center-left through the wave train.",
      source: "aw",
    },
    {
      riverId: salmon.id,
      name: "Salmon Falls",
      difficulty: "Class IV",
      mile: 32.0,
      description: "Biggest rapid on the Main Salmon. A powerful drop with a large hydraulic.",
      runGuide: "Run far right at lower flows, center-right at higher flows. Avoid the left wall.",
      source: "aw",
    },
    {
      riverId: arkansas.id,
      name: "Zoom Flume",
      difficulty: "Class III",
      mile: 3.2,
      description: "Fun wave train with a big splash at the bottom. The classic Browns Canyon rapid.",
      runGuide: "Enter center and ride the wave train. Stay right of the large rock at the bottom.",
      source: "aw",
    },
    {
      riverId: arkansas.id,
      name: "Seidel's Suckhole",
      difficulty: "Class III+",
      mile: 4.5,
      description: "The most technical rapid in Browns Canyon. Named for the sticky hole at the bottom.",
      runGuide: "Enter left of center. Move right to avoid the suckhole, or punch it straight on at higher flows.",
      source: "aw",
    },
  ];

  await prisma.rapid.deleteMany({
    where: { riverId: { in: [colorado.id, salmon.id, arkansas.id] } },
  });
  await prisma.rapid.createMany({ data: rapidsData });
  console.log(`  ✓ Rapids: ${rapidsData.length} records`);

  // ─── Gear Deals ──────────────────────────────────────────
  const dealsData = [
    {
      title: "14ft NRS Otter Raft — Great Condition",
      price: 2800,
      url: "https://denver.craigslist.org/boa/d/14ft-nrs-otter-raft/001.html",
      imageUrl: "https://images.unsplash.com/photo-1572117474785-5067c191aa13?w=400",
      description: "Well-maintained 14' NRS Otter with frame, oars, and dry boxes. Used for 3 seasons on the Colorado. Self-bailing floor in great shape.",
      category: "raft",
      region: "denver",
      postedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      scrapedAt: now,
      isActive: true,
    },
    {
      title: "Dagger Mamba 8.6 Creeker — Barely Used",
      price: 650,
      url: "https://boise.craigslist.org/boa/d/dagger-mamba-creeker/002.html",
      imageUrl: "https://images.unsplash.com/photo-1545214843-8f0e94790288?w=400",
      description: "Dagger Mamba 8.6 in fire red. Paddled maybe 15 times. No gouges or repairs. Includes skirt and paddle.",
      category: "kayak",
      region: "boise",
      postedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      scrapedAt: now,
      isActive: true,
    },
    {
      title: "NRS Chinook PFD — Type III, Size L",
      price: 45,
      url: "https://denver.craigslist.org/spo/d/nrs-chinook-pfd/003.html",
      description: "NRS Chinook fishing PFD, size large. Worn twice, basically new. Retails for $110.",
      category: "pfd",
      region: "denver",
      postedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      scrapedAt: now,
      isActive: true,
    },
  ];

  for (const deal of dealsData) {
    await prisma.gearDeal.upsert({
      where: { url: deal.url },
      update: { isActive: deal.isActive, scrapedAt: deal.scrapedAt },
      create: deal,
    });
  }
  console.log(`  ✓ Gear deals: ${dealsData.length} records`);

  // ─── Deal Filter ─────────────────────────────────────────
  const filter = await prisma.dealFilter.upsert({
    where: { id: "demo-filter" },
    update: {},
    create: {
      id: "demo-filter",
      userId: user.id,
      name: "Rafts & Kayaks under $3000",
      keywords: ["raft", "kayak", "canoe", "nrs", "dagger", "aire"],
      categories: ["raft", "kayak"],
      maxPrice: 3000,
      regions: ["denver", "boulder", "fortcollins", "boise"],
      isActive: true,
    },
  });
  console.log(`  ✓ Deal filter: ${filter.name}`);

  // ─── Trips ───────────────────────────────────────────────
  const tripStartDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
  const tripEndDate = new Date(now.getTime() + 17 * 24 * 60 * 60 * 1000); // 3-day trip

  const trip = await prisma.trip.upsert({
    where: { id: "demo-trip" },
    update: {
      name: "Gore Canyon Weekend",
      startDate: tripStartDate,
      endDate: tripEndDate,
      status: "planning",
      notes: "Spring runoff trip — check flows before committing. Backup plan: Browns Canyon.",
      isPublic: true,
    },
    create: {
      id: "demo-trip",
      userId: user.id,
      name: "Gore Canyon Weekend",
      startDate: tripStartDate,
      endDate: tripEndDate,
      status: "planning",
      notes: "Spring runoff trip — check flows before committing. Backup plan: Browns Canyon.",
      isPublic: true,
    },
  });
  console.log(`  ✓ Trip: ${trip.name}`);

  // ─── Trip Stops ──────────────────────────────────────────
  await prisma.tripStop.deleteMany({ where: { tripId: trip.id } });

  const tripStopsData = [
    {
      tripId: trip.id,
      riverId: colorado.id,
      dayNumber: 1,
      notes: "Gore Canyon — full day. Scout Appaloosa and Gore Rapid before launching.",
      putInTime: "09:00",
      takeOutTime: "16:00",
      sortOrder: 0,
    },
    {
      tripId: trip.id,
      riverId: arkansas.id,
      dayNumber: 2,
      notes: "Browns Canyon — warm-up day. Stop at Zoom Flume for photos.",
      putInTime: "10:00",
      takeOutTime: "14:00",
      sortOrder: 0,
    },
    {
      tripId: trip.id,
      riverId: arkansas.id,
      dayNumber: 3,
      notes: "Browns Canyon again — try the Seidel's Suckhole line.",
      putInTime: "09:30",
      takeOutTime: "13:00",
      sortOrder: 0,
    },
  ];

  await prisma.tripStop.createMany({ data: tripStopsData });
  console.log(`  ✓ Trip stops: ${tripStopsData.length} stops for "${trip.name}"`);

  // ─── River Reviews ───────────────────────────────────────
  const reviewsData = [
    {
      riverId: colorado.id,
      userId: user.id,
      rating: 5,
      title: "World-class canyon run",
      body: "Gore Canyon is an incredible experience. The continuous whitewater through the deep canyon is unlike anything else in Colorado. Appaloosa and Gore Rapid are must-scout rapids. Water was around 1,200 CFS — perfect level for a challenging but clean run.",
      visitDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      difficulty: "Class IV",
    },
    {
      riverId: arkansas.id,
      userId: user.id,
      rating: 4,
      title: "Great family-friendly run",
      body: "Browns Canyon is Colorado's most popular rafting stretch for good reason. Zoom Flume and Seidel's Suckhole provide real thrills, but the overall difficulty is manageable for intermediate paddlers. Beautiful granite canyon scenery. Go early in the morning to beat the commercial raft traffic.",
      visitDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      difficulty: "Class III",
    },
    {
      riverId: salmon.id,
      userId: user.id,
      rating: 5,
      title: "Bucket-list wilderness trip",
      body: "The River of No Return lives up to its name. 79 miles of pristine wilderness with no road access. Salmon Falls is the highlight — a powerful Class IV drop that demands respect. The hot springs along the way are an incredible bonus. Plan for the permit lottery well in advance.",
      visitDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      difficulty: "Class III-IV",
    },
  ];

  for (const review of reviewsData) {
    await prisma.riverReview.upsert({
      where: {
        riverId_userId: { riverId: review.riverId, userId: review.userId },
      },
      update: {
        rating: review.rating,
        title: review.title,
        body: review.body,
        visitDate: review.visitDate,
        difficulty: review.difficulty,
      },
      create: review,
    });
  }
  console.log(`  ✓ River reviews: ${reviewsData.length} reviews`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
