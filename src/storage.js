// Simula window.storage di Claude usando localStorage
window.storage = {
  async get(key) {
    const val = localStorage.getItem(key);
    if (val === null) throw new Error("Key not found: " + key);
    return { key, value: val };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
  async list(prefix) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!prefix || k.startsWith(prefix)) keys.push(k);
    }
    return { keys };
  }
};
