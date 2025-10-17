const { isCommonPassword, analyzePasswordSimilarity } = require('../utils/commonPasswords');

class PasswordService {
  
  constructor() {
    this.ATTACK_RATE = Math.pow(10, 11);
    
    this.ALPHABET_SIZES = {
      lowercase: 26,
      uppercase: 26,
      numbers: 10,
      symbols: 32
    };

    this.STRENGTH_LEVELS = {
      VERY_WEAK_COMMON: 'Muy Débil (común)',
      WEAK_ACCEPTABLE: 'Débil o Aceptable',
      STRONG: 'Fuerte',
      VERY_STRONG: 'Muy Fuerte'
    };
  }

  detectCharacterTypes(password) {
    const types = {
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumbers: /[0-9]/.test(password),
      hasSymbols: /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(password)
    };

    return types;
  }

  calculateAlphabetSize(characterTypes) {
    let alphabetSize = 0;

    if (characterTypes.hasLowercase) {
      alphabetSize += this.ALPHABET_SIZES.lowercase;
    }
    
    if (characterTypes.hasUppercase) {
      alphabetSize += this.ALPHABET_SIZES.uppercase;
    }
    
    if (characterTypes.hasNumbers) {
      alphabetSize += this.ALPHABET_SIZES.numbers;
    }
    
    if (characterTypes.hasSymbols) {
      alphabetSize += this.ALPHABET_SIZES.symbols;
    }

    return alphabetSize || this.ALPHABET_SIZES.lowercase;
  }

  calculateEntropy(password) {
    const length = password.length;
    const characterTypes = this.detectCharacterTypes(password);
    const alphabetSize = this.calculateAlphabetSize(characterTypes);
    
    const entropy = length * Math.log2(alphabetSize);
    
    return Math.round(entropy * 100) / 100;
  }

  classifyStrength(entropy, isCommon) {
    if (isCommon) {
      return this.STRENGTH_LEVELS.VERY_WEAK_COMMON;
    }

    if (entropy >= 80) {
      return this.STRENGTH_LEVELS.VERY_STRONG;
    } else if (entropy >= 60) {
      return this.STRENGTH_LEVELS.STRONG;
    } else {
      return this.STRENGTH_LEVELS.WEAK_ACCEPTABLE;
    }
  }

  calculateCrackTime(entropy, isCommon) {
    if (isCommon) {
      return 0.01;
    }

    const totalCombinations = Math.pow(2, entropy);
    const crackTimeSeconds = totalCombinations / (2 * this.ATTACK_RATE);
    
    return Math.round(crackTimeSeconds * 100) / 100;
  }

  applyCommonPasswordPenalty(entropy, isCommon) {
    if (isCommon) {
      return Math.round(entropy * 0.8 * 100) / 100;
    }
    return entropy;
  }

  async evaluatePassword(password) {
    try {
      const isCommon = await isCommonPassword(password);
      const similarityAnalysis = await analyzePasswordSimilarity(password);
      
      let entropy = this.calculateEntropy(password);
      
      if (isCommon) {
        entropy = this.applyCommonPasswordPenalty(entropy, isCommon);
      }
      
      const strength = this.classifyStrength(entropy, isCommon);
      const estimatedCrackTimeSeconds = this.calculateCrackTime(entropy, isCommon);
      const suggestions = this.generatePasswordSuggestions(password, similarityAnalysis);

      return {
        entropy,
        strength,
        estimatedCrackTimeSeconds,
        similarityAnalysis,
        suggestions,
        metadata: {
          length: password.length,
          characterTypes: this.detectCharacterTypes(password),
          alphabetSize: this.calculateAlphabetSize(this.detectCharacterTypes(password)),
          isCommonPassword: isCommon
        }
      };

    } catch (error) {
      console.error('Error en evaluatePassword:', error.message);
      throw new Error('Error al evaluar la contraseña');
    }
  }

  generatePasswordSuggestions(password, similarityAnalysis) {
    const suggestions = [];
    const characterTypes = this.detectCharacterTypes(password);
    
    // Sugerencias basadas en el análisis de similitud
    if (similarityAnalysis.isCommon) {
      suggestions.push({
        type: 'critical',
        message: 'Usar una contraseña completamente diferente',
        reason: 'Esta contraseña aparece en listas de contraseñas comprometidas'
      });
    } else if (similarityAnalysis.hasSimilar) {
      const mostSimilar = similarityAnalysis.similarPasswords[0];
      if (mostSimilar.type === 'simple_variation') {
        suggestions.push({
          type: 'warning',
          message: 'Evitar variaciones simples de contraseñas comunes',
          reason: 'Agregar solo números o cambiar mayúsculas no mejora significativamente la seguridad'
        });
      } else {
        suggestions.push({
          type: 'info',
          message: 'Considerar una contraseña menos predecible',
          reason: `La contraseña actual es similar a "${mostSimilar.password}"`
        });
      }
    }
    
    // Sugerencias basadas en caracteres
    if (!characterTypes.hasLowercase) {
      suggestions.push({
        type: 'improvement',
        message: 'Agregar letras minúsculas',
        reason: 'Aumenta la complejidad del alfabeto disponible'
      });
    }
    
    if (!characterTypes.hasUppercase) {
      suggestions.push({
        type: 'improvement',
        message: 'Agregar letras mayúsculas',
        reason: 'Aumenta la complejidad del alfabeto disponible'
      });
    }
    
    if (!characterTypes.hasNumbers) {
      suggestions.push({
        type: 'improvement',
        message: 'Agregar números',
        reason: 'Aumenta la complejidad del alfabeto disponible'
      });
    }
    
    if (!characterTypes.hasSymbols) {
      suggestions.push({
        type: 'improvement',
        message: 'Agregar símbolos especiales (!@#$%^&*)',
        reason: 'Maximiza la complejidad del alfabeto disponible'
      });
    }
    
    // Sugerencias basadas en longitud
    if (password.length < 8) {
      suggestions.push({
        type: 'critical',
        message: 'Usar al menos 8 caracteres',
        reason: 'Contraseñas cortas son vulnerables a ataques de fuerza bruta'
      });
    } else if (password.length < 12) {
      suggestions.push({
        type: 'improvement',
        message: 'Considerar usar al menos 12 caracteres',
        reason: 'Mayor longitud proporciona mejor protección'
      });
    }
    
    // Sugerencias generales
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'success',
        message: 'Contraseña cumple con criterios básicos de seguridad',
        reason: 'Continuar monitoreando y actualizar periódicamente'
      });
    }
    
    return suggestions;
  }

  getEvaluationCriteria() {
    return {
      alphabetSizes: this.ALPHABET_SIZES,
      strengthLevels: this.STRENGTH_LEVELS,
      attackRate: this.ATTACK_RATE,
      entropyFormula: 'E = L × log2(N), donde L=longitud y N=tamaño del alfabeto',
      crackTimeFormula: 'tiempo = 2^entropía / (2 × tasa_de_ataque)'
    };
  }
}

const passwordService = new PasswordService();

module.exports = passwordService;