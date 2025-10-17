const fs = require('fs').promises;
const path = require('path');

class CommonPasswordsManager {
  
  constructor() {
    this.commonPasswords = new Set();
    this.passwordsArray = []; // Para búsquedas de similitud
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
      
      let isFirstLine = true;
      
      for (const line of lines) {
        if (line && line.length > 0) {
          // Saltar la primera línea (header)
          if (isFirstLine) {
            isFirstLine = false;
            continue;
          }
          
          const parts = line.split(',');
          if (parts.length >= 2) {
            const password = parts[1].trim(); // Tomar la segunda columna (la contraseña)
            
            if (password && password.length > 0 && !password.startsWith('#')) {
              this.commonPasswords.add(password);
              this.passwordsArray.push(password); // Para búsquedas de similitud
              loadedCount++;
            }
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
    this.passwordsArray = [];
    this.loadingPromise = null;
    await this.loadCommonPasswords();
  }

  // Función para calcular la distancia de Levenshtein
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Función para calcular similitud basada en caracteres comunes
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1.0;
    
    const distance = this.levenshteinDistance(str1, str2);
    return (maxLen - distance) / maxLen;
  }

  // Función para detectar si una contraseña es una variación simple
  isSimpleVariation(original, test) {
    const lower1 = original.toLowerCase();
    const lower2 = test.toLowerCase();
    
    // Verificar si es la misma contraseña con diferente caso
    if (lower1 === lower2) return true;
    
    // Verificar si es la misma con números agregados al final
    if (lower2.startsWith(lower1) && /^\d+$/.test(test.slice(original.length))) {
      return true;
    }
    
    // Verificar si es la misma con números agregados al inicio
    if (lower2.endsWith(lower1) && /^\d+$/.test(test.slice(0, test.length - original.length))) {
      return true;
    }
    
    // Verificar si solo difiere en 1-2 caracteres
    const distance = this.levenshteinDistance(lower1, lower2);
    return distance <= 2 && Math.abs(original.length - test.length) <= 2;
  }

  async findSimilarPasswords(password, maxResults = 5, minSimilarity = 0.7) {
    await this.loadCommonPasswords();
    
    const similarPasswords = [];
    const lowerPassword = password.toLowerCase();
    
    // Buscar contraseñas exactas (incluyendo variaciones de mayúsculas)
    for (const commonPwd of this.passwordsArray) {
      if (commonPwd.toLowerCase() === lowerPassword) {
        similarPasswords.push({
          password: commonPwd,
          similarity: 1.0,
          type: 'identical',
          message: 'Contraseña idéntica encontrada en la base de datos'
        });
        continue;
      }
      
      // Buscar variaciones simples
      if (this.isSimpleVariation(commonPwd, password)) {
        similarPasswords.push({
          password: commonPwd,
          similarity: 0.9,
          type: 'simple_variation',
          message: 'Variación simple de una contraseña común'
        });
        continue;
      }
      
      // Buscar similitudes por distancia de edición
      const similarity = this.calculateSimilarity(password, commonPwd);
      if (similarity >= minSimilarity) {
        similarPasswords.push({
          password: commonPwd,
          similarity: similarity,
          type: 'similar',
          message: `Contraseña similar (${(similarity * 100).toFixed(1)}% de similitud)`
        });
      }
    }
    
    // Ordenar por similitud descendente y limitar resultados
    return similarPasswords
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  async analyzePasswordSimilarity(password) {
    await this.loadCommonPasswords();
    
    const isExact = await this.isCommonPassword(password);
    const similarPasswords = await this.findSimilarPasswords(password, 3, 0.7);
    
    let analysisResult = {
      isCommon: isExact,
      hasSimilar: similarPasswords.length > 0,
      similarPasswords: similarPasswords,
      message: '',
      recommendation: '',
      securityLevel: 'unknown'
    };
    
    if (isExact) {
      analysisResult.message = 'Esta contraseña es muy común y aparece en listas de contraseñas filtradas.';
      analysisResult.recommendation = 'Usar una contraseña completamente diferente y única.';
      analysisResult.securityLevel = 'very_low';
    } else if (similarPasswords.length > 0) {
      const mostSimilar = similarPasswords[0];
      if (mostSimilar.type === 'simple_variation') {
        analysisResult.message = 'Esta contraseña es una variación simple de una contraseña común.';
        analysisResult.recommendation = 'Crear una contraseña más compleja y única.';
        analysisResult.securityLevel = 'low';
      } else {
        analysisResult.message = `Esta contraseña es similar a contraseñas comunes (máx. ${(mostSimilar.similarity * 100).toFixed(1)}% de similitud).`;
        analysisResult.recommendation = 'Considerar una contraseña más única para mayor seguridad.';
        analysisResult.securityLevel = 'medium_low';
      }
    } else {
      analysisResult.message = 'Esta contraseña no se encontró en la base de datos de contraseñas comunes.';
      analysisResult.recommendation = 'Continuar evaluando otros aspectos de seguridad.';
      analysisResult.securityLevel = 'acceptable';
    }
    
    return analysisResult;
  }
}

const commonPasswordsManager = new CommonPasswordsManager();

module.exports = {
  isCommonPassword: (password) => commonPasswordsManager.isCommonPassword(password),
  getStats: () => commonPasswordsManager.getStats(),
  reload: () => commonPasswordsManager.reload(),
  findSimilarPasswords: (password, maxResults, minSimilarity) => 
    commonPasswordsManager.findSimilarPasswords(password, maxResults, minSimilarity),
  analyzePasswordSimilarity: (password) => 
    commonPasswordsManager.analyzePasswordSimilarity(password),
  manager: commonPasswordsManager
};