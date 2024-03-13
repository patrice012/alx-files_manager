const { promisify } = require('util');
const redis = require('redis');

/**
 * Represents a redis client.
 */
class RedisClient {
  /**
     * Create a new RedisClient instance
     */
  constructor() {
    this.client = redis.createClient();

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.connected = false;
    this.client.on('connect', () => {
      this.connected = true;
    });
  }

  /**
   * Checks if this client's connection to Redis server is active.
   * @returns {boolean}
   */
  isAlive() {
    return this.connected;
  }

  /**
   * Retrieves the value of a given key.
   * @param {String} key Key of item to retrieve.
   * @returns {String | Object}
   */
  async get(key) {
    return promisify(this.client.get).bind(this.client)(key);
  }

  /**
   * Stores a key, its value and its expiration time.
   * @param {String} key Key of the item to store
   * @param {String | Number | Boolean} value Item to store.
   * @param {Number} duration The expiration time of the item.
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    await promisify(this.client.setex).bind(this.client)(key, duration, value);
  }

  /**
   * Removes the value of a given key.
   * @param {String} key The key of the item to remove.
   * @returns {Promise<void>}
   */
  async del(key) {
    await promisify(this.client.del).bind(this.client)(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
