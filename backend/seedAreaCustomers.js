const { seedAreaCustomers } = require('../seedAreaCustomers');

if (require.main === module) {
  seedAreaCustomers()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedAreaCustomers };
