const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  static getStatus(req, res) {
    if (redisClient.isAlive() && dbClient.isAlive()) {
      res.json({ redis: true, db: true });
      res.end();
    }
  }

  static async getStats(req, res) {
    try {
      const users = await dbClient.nbUsers();
      const files = await dbClient.nbFiles();
      res.json({ users, files });
      res.end();
    } catch (error) {
      console.log(error.message);
    }
  }
}

module.exports = AppController;
