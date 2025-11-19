// src/utils/commonPasswords.js
const databaseService = require('../services/databaseService');

class CommonPasswordsManager {
  
  constructor() {
    this.isLoaded = true;
  }

  async isCommonPassword(password) {
    return await databaseService.isCommonPassword(password);
  }

  async getStats() {
    const dbStats = await databaseService.getStats();
    return {
      totalCommonPasswords: dbStats.totalPasswords || 0,
      isLoaded: true,
      databaseStats: dbStats
    };
  }

  async reload() {
    databaseService.clearCache();
    console.log('✅ Cache limpiado');
  }

  async findSimilarPasswords(password, maxResults = 3) {
    return await databaseService.findSimilarPasswords(password, maxResults);
  }

  async analyzePasswordSimilarity(password) {
    // OPTIMIZACIÓN: Hacer ambas consultas en paralelo
    const [isExact, similarPasswords] = await Promise.all([
      this.isCommonPassword(password),
      this.findSimilarPasswords(password, 3)
    ]);
    
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
        analysisResult.message = 'Esta contraseña tiene similitudes con contraseñas comunes.';
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
  findSimilarPasswords: (password, maxResults) => 
    commonPasswordsManager.findSimilarPasswords(password, maxResults),
  analyzePasswordSimilarity: (password) => 
    commonPasswordsManager.analyzePasswordSimilarity(password),
  manager: commonPasswordsManager
};