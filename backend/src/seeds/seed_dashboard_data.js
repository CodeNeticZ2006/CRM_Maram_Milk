// Disabled synthetic mock data seeder. All dashboard metrics are dynamically computed from live CRM DB tables.
module.exports = { seedData: async () => { console.log('Live mode active: synthetic dashboard seeding skipped.'); } };
