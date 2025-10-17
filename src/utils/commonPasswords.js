const fs = require('fs').promises;
const path = require('path');

class CommonPasswordsManager {
  
  constructor() {
    this.commonPasswords = new Set();
    this.isLoaded = false;
    this.loadingPromise = null;
  }

  async loadCommonPasswords() {
    if (this.isLoaded) {
      return;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._performLoad();
    
    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  async _performLoad() {
    try {
      const csvPath = path.join(__dirname, '../data/1millionPasswords.csv');
      
      console.log(`Loading common passwords from: ${csvPath}`);
      
      await fs.access(csvPath);

      const fileContent = await fs.readFile(csvPath, 'utf-8');
      const lines = fileContent.split('\n').map(line => line.trim());
      
      let loadedCount = 0;
      
      for (const line of lines) {
        if (line && line.length > 0) {
          const password = line.split(',')[0].trim();
          
          if (password && password.length > 0 && !password.startsWith('#')) {
            this.commonPasswords.add(password);
            loadedCount++;
          }
        }
      }

      this.isLoaded = true;
      console.log(`Loaded ${loadedCount} common passwords from 1millionPasswords.csv`);
      
    } catch (error) {
      console.error('Error loading common passwords:', error.message);
      console.warn('Continuing without common password verification');
      
      this.isLoaded = true;
    }
  }

  async isCommonPassword(password) {
    await this.loadCommonPasswords();
    
    const lowerPassword = password.toLowerCase();
    
    return this.commonPasswords.has(password) || 
           this.commonPasswords.has(lowerPassword);
  }

  async getStats() {
    await this.loadCommonPasswords();
    
    return {
      totalCommonPasswords: this.commonPasswords.size,
      isLoaded: this.isLoaded,
      memoryUsage: `${Math.round(this.commonPasswords.size * 50 / 1024)} KB (approx.)`
    };
  }

  async reload() {
    this.isLoaded = false;
    this.commonPasswords.clear();
    await this.loadCommonPasswords();
  }
}

const commonPasswordsManager = new CommonPasswordsManager();

module.exports = {
  isCommonPassword: (password) => commonPasswordsManager.isCommonPassword(password),
  getStats: () => commonPasswordsManager.getStats(),
  reload: () => commonPasswordsManager.reload(),
  manager: commonPasswordsManager
};