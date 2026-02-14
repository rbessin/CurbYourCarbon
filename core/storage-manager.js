/**
 * IndexedDB storage manager for carbon events and summaries.
 */
import { DB_NAME, STORE_NAMES } from "./constants.js";

export class StorageManager {
  constructor() {
    this.dbPromise = null;
  }

  /**
   * Initialize IndexedDB and create required object stores.
   * @returns {Promise<IDBDatabase>}
   */
  async initDB() {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAMES.events)) {
          const eventsStore = db.createObjectStore(STORE_NAMES.events, {
            keyPath: "id",
            autoIncrement: true,
          });
          eventsStore.createIndex("timestamp", "timestamp", { unique: false });
          eventsStore.createIndex("type", "type", { unique: false });
          eventsStore.createIndex("platform", "platform", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_NAMES.dailySummary)) {
          db.createObjectStore(STORE_NAMES.dailySummary, { keyPath: "date" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Failed to open IndexedDB"));
    });

    return this.dbPromise;
  }

  /**
   * Save a single event record.
   * @param {Object} event
   * @returns {Promise<Object>}
   */
  async saveEvent(event) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.events, "readwrite");
      const store = tx.objectStore(STORE_NAMES.events);

      store.add(event);

      tx.oncomplete = () => resolve(event);
      tx.onerror = () => reject(tx.error || new Error("Failed to save event"));
    });
  }

  /**
   * Get all events for today.
   * @returns {Promise<Array>}
   */
  async getEventsToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return this.getEventsInRange(start, end);
  }

  /**
   * Get events between start and end dates.
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Array>}
   */
  async getEventsInRange(startDate, endDate) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.events, "readonly");
      const store = tx.objectStore(STORE_NAMES.events);
      const index = store.index("timestamp");
      const range = IDBKeyRange.bound(startDate.getTime(), endDate.getTime());
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () =>
        reject(request.error || new Error("Failed to read events"));
    });
  }

  /**
   * Get daily summary by date key (YYYY-MM-DD).
   * @param {string} date
   * @returns {Promise<Object|null>}
   */
  async getDailySummary(date) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.dailySummary, "readonly");
      const store = tx.objectStore(STORE_NAMES.dailySummary);
      const request = store.get(date);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () =>
        reject(request.error || new Error("Failed to read daily summary"));
    });
  }

  /**
   * Save or update a daily summary.
   * @param {Object} summary
   * @returns {Promise<Object>}
   */
  async saveDailySummary(summary) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.dailySummary, "readwrite");
      const store = tx.objectStore(STORE_NAMES.dailySummary);

      store.put(summary);

      tx.oncomplete = () => resolve(summary);
      tx.onerror = () =>
        reject(tx.error || new Error("Failed to save daily summary"));
    });
  }

  /**
   * Get total impact across all events.
   * @returns {Promise<{totalCarbon: number, byCategory: Object, byPlatform: Object}>}
   */
  async getTotalImpact() {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES.events, "readonly");
      const store = tx.objectStore(STORE_NAMES.events);
      const request = store.getAll();

      request.onsuccess = () => {
        const events = request.result || [];
        const totals = {
          totalCarbon: 0,
          byCategory: { video: 0, social: 0, shopping: 0 },
          byPlatform: {},
        };

        events.forEach((event) => {
          const grams = event.carbonGrams || 0;
          totals.totalCarbon += grams;
          if (totals.byCategory[event.type] !== undefined) {
            totals.byCategory[event.type] += grams;
          }
          if (!totals.byPlatform[event.platform]) {
            totals.byPlatform[event.platform] = 0;
          }
          totals.byPlatform[event.platform] += grams;
        });

        resolve(totals);
      };

      request.onerror = () =>
        reject(request.error || new Error("Failed to read total impact"));
    });
  }
}
