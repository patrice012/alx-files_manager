const { ObjectID } = require('mongodb');
const redisClient = require('./redis');
const dbClient = require('./db');
const basicUtils = require('./basic');

class AuthClient {
  static async authenticateUser(token) {
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return null;
    }

    if (!basicUtils.isValidId(userId)) {
      return null;
    }

    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectID(userId) });
    return user;
  }
}

module.exports = AuthClient;
